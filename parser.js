'use strict';

const iconv = require('iconv-lite');
const diacritics = require('diacritics');

module.exports = {
  parse: function(data, validate = true) {
    const result = {
      chunkStarts: [],
    };
    const buffer = new Buffer(data);

    // Process header information
    processHeader(buffer, result);

    // Make sure file ends correctly...
    if (!buffer.slice(buffer.length - 4, buffer.length).equals(new Buffer([0, 0, 0xFF, 0xFF]))) {
      throw new Error('Truncated save file detected!');
    }

    let chunkCount = 0;
    let chunk = {
      endIndex: result.headerLength,
    };

    result.civilizations = [];

    while (null !== (chunk = getChunk(buffer, chunk.endIndex))) {
      result.chunkStarts[chunkCount] = chunk.startIndex - DELIMITER.length;

      // 1st chunk contains player names
      if (chunkCount === 1) {
        while (chunk.pos < chunk.buffer.length) {
          result.civilizations.push({
            playerName: readString(chunk),
          });
        }
      }

      // 2nd chunk contains the type/status of civilization - 1 alive, 2 dead, 3 human, 4 missing
      if (
        chunkCount === 2 ||
        (result.civ === 'CIV5' && chunkCount === 26) ||
        (result.civ === 'CIVBE' && chunkCount === 29)
      ) {
        let i = 0;
        while (chunk.pos < chunk.buffer.length) {
          if (!result.civilizations[i]) {
            break;
          }

          if (!result.civilizations[i].type) {
            result.civilizations[i].type = readInt(chunk);
          } else {
            const secondaryType = readInt(chunk);
            if (validate && result.civilizations[i].type !== secondaryType) {
              console.log(chunk.buffer);
              throw new Error(
                  `Secondary player type chunk did not validate! ` +
                  `Index: ${i}, type: ${result.civilizations[i].type}, secondary: ${secondaryType}`
              );
            }
          }

          i++;
        }
      }

      // 6th chunk contains all civ names
      if (chunkCount === 6) {
        let i = 0;
        while (chunk.pos < chunk.buffer.length) {
          const civ = readString(chunk);
          if (civ.trim() !== '') {
            result.civilizations[i].name = civ;
          }
          i++;
        }
      }

      // 7th chunk contains leader names and current player byte
      // The current player byte is at the end of the seventh chunk...
      if (chunkCount === 7) {
        // Read through leader names
        result.barbarianCount = 0;
        let i = 0;
        while (chunk.pos < chunk.buffer.length && i < result.civilizations.length) {
          result.civilizations[i].leader = readString(chunk);
          if (result.civilizations[i].leader === 'LEADER_BARBARIAN') {
            result.barbarianCount++;
          }
          i++;
        }
        // Look 4 bytes backwards from end of chunk for the current player...
        result.player = chunk.buffer.readUInt32LE(chunk.buffer.length - 16);
      }

      // 11th chunk contains passwords
      if (chunkCount === 11) {
        let i = 0;
        while (chunk.pos < chunk.buffer.length && i < result.civilizations.length) {
          result.civilizations[i].password = readString(chunk);
          i++;
        }
      }

      if ((result.civ === 'CIV5' && chunkCount === 23) || (result.civ === 'CIVBE' && chunkCount === 26)) {
        // Read through player colors, make sure we find them to fix turn 64 issues
        let i = 0;
        while (chunk.pos < chunk.buffer.length && i < result.civilizations.length) {
          const colorString = readString(chunk);

          if (i === 0 && !colorString) {
            chunkCount--;
            break;
          }

          result.civilizations[i].color = colorString;

          i++;
        }
      }
      chunkCount++;
    }

    // remove missing civs (status 4)
    for (let i = result.civilizations.length-1; i >= 0; i--) {
      if (!result.civilizations[i].name || result.civilizations[i].type === 4) {
        result.civilizations.splice(i, 1);
      }
    }

    return result;
  },
  changeCivType: function(data, position, type) {
    const result = {};
    processHeader(data, result);

    // type/status of civilization, seems to be in multiple places - 1 alive, 2 dead, 3 human, 4 missing
    data = writeInt(data, 2, position, type);

    if (result.civ === 'CIV5') {
      data = writeInt(data, 26, position, type);
    }

    if (result.civ === 'CIVBE') {
      data = writeInt(data, 29, position, type);
    }

    return data;
  },
  changePlayer: function(data, newPlayer) {
    const chunk = findChunk(data, 7);
    const buffer = new Buffer(data);
    buffer.writeUInt32LE(newPlayer, chunk.startIndex + chunk.buffer.length - 16);
    return buffer;
  },
  changeCivPassword: function(data, position, password) {
    return writeString(data, 11, position, password);
  },
  changePlayerName: function(data, position, playerName) {
    return writeString(data, 1, position, playerName);
  },
};

// Parse helper functions
const DELIMITER = new Buffer([0x40, 0, 0, 0]);

function getChunk(buffer, startIndex) {
  const result = {
    startIndex: startIndex,
    pos: 0,
  };

  if (!startIndex) {
    result.startIndex = buffer.indexOf(DELIMITER);
  }

  result.startIndex += DELIMITER.length;

  result.endIndex = buffer.indexOf(DELIMITER, result.startIndex);

  if (result.endIndex >= 0) {
    result.buffer = buffer.slice(result.startIndex, result.endIndex);
    return result;
  }

  return null;
}

function processHeader(buffer, result) {
  const buf = {
    buffer: buffer,
    pos: 0,
  };

  result.civ = readString(buf, 4);

  if (result.civ !== 'CIV5') {
    buf.pos = 0;
    result.civ = readString(buf, 5);

    if (result.civ !== 'CIVBE') {
      throw new Error('No Civ Save File Header Found!');
    }
  }

  result.save = readInt(buf);
  result.game = readString(buf);
  result.build = readString(buf);
  result.turn = readInt(buf);
  // TODO: investigate this Byte
  skipBytes(buf, 1);
  result.startingCiv = readString(buf);
  result.handicap = readString(buf);
  result.era = readString(buf);
  result.currentEra = readString(buf);
  result.gameSpeed = readString(buf);
  result.worldSize = readString(buf);
  result.mapScript = readString(buf);
  result.mods = [];

  const dlcLength = readInt(buf);

  for (let i = 0; i < dlcLength; i++) {
    const id = buf.buffer.slice(buf.pos, (buf.pos += 16)).toString('hex');
    buf.pos += 4;
    const name = readString(buf);

    result.mods.push({id, name});
  }

  // Skipping rest of header - There is still more content in the header to investigate
  result.headerLength = buf.buffer.indexOf(DELIMITER, buf.pos);
}

function readString(buf, length) {
  if (!length) {
    length = readInt(buf);

    if (length === 0 || length > 1000) {
      return '';
    }
  }

  return buf.buffer.slice(buf.pos, (buf.pos += length)).toString();
}

function readInt(buf) {
  const int = buf.buffer.readUInt32LE(buf.pos);
  buf.pos+=4;
  return int;
}

function skipBytes(buf, num) {
  buf.pos += num;
}

// Write helper functions
function encodeString(text) {
  const safeValue = iconv.encode(diacritics.remove(text), 'ascii');
  const length = safeValue.length;
  const result = new Buffer(length+4);

  result.writeUInt32LE(length, 0);
  safeValue.copy(result, 4);

  return result;
}

function findChunk(data, chunkNum) {
  const result = module.exports.parse(data, false);
  const buffer = new Buffer(data);
  return getChunk(buffer, result.chunkStarts[chunkNum]);
}

function writeInt(data, chunkNum, position, newValue) {
  const chunk = findChunk(data, chunkNum);
  const buffer = new Buffer(data);

  let posCount = 0;

  while (chunk.pos < chunk.buffer.length) {
    if (posCount === position) {
      const pos = chunk.startIndex + chunk.pos;
      const toUpdate = buffer.slice(pos, pos + 4);
      toUpdate.writeUInt32LE(newValue);
      return buffer;
    }

    readInt(chunk);
    posCount++;
  }

  throw new Error('Could not find position ' + position);
}

function writeString(data, chunkNum, position, newString) {
  const chunk = findChunk(data, chunkNum);

  for (let i=0; i<position; i++) {
    readString(chunk);
  }

  const pos = chunk.startIndex + chunk.pos;
  const encodedString = encodeString(newString);
  const encodedLength = encodedString.length;
  const currentString = readString(chunk);
  const currentLength = Buffer.byteLength(currentString, 'utf8');

  // create new buffer with new length
  const result = new Buffer(data.length - (currentLength + 4) + encodedLength);
  // get buffer before currentString
  data.copy(result, 0, 0, pos);
  // add encodedString to buffer
  encodedString.copy(result, pos);
  // copy the rest of the buffer starting after the existing string
  data.copy(result, pos + encodedLength, pos + currentLength + 4);

  return result;
}
