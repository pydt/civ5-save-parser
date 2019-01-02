'use strict';

module.exports = {
  parse: function(data) {
    const result = {};
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
      // 1st chunk contains player names
      if (chunkCount === 1) {
        while (chunk.pos < chunk.buffer.length) {
          result.civilizations.push({
            playerName: readString(chunk),
          });
        }
      }

      // 2nd chunk contains the type/status of civilization - 1 alive, 2 dead, 3 human, 4 missing
      if (chunkCount === 2) {
        let i = 0;
        while (chunk.pos < chunk.buffer.length) {
          result.civilizations[i].type = readInt(chunk);
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

      // 23rd chunk contains player colors
      if (chunkCount === 23) {
        // Read through player colors
        let i = 0;
        while (chunk.pos < chunk.buffer.length && i < result.civilizations.length) {
          result.civilizations[i].color = readString(chunk);
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

function getChunk(buffer, startIndex) {
  const delimiter = new Buffer([0x40, 0, 0, 0]);
  const result = {
    startIndex: startIndex,
    pos: 0,
  };

  if (!startIndex) {
    result.startIndex = buffer.indexOf(delimiter);
  }

  result.startIndex += delimiter.length;

  result.endIndex = buffer.indexOf(delimiter, result.startIndex);

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
  const delimiter = new Buffer([0x40, 0, 0, 0]);
  result.headerLength = buf.buffer.indexOf(delimiter, buf.pos);
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
  const length = text.length;
  const result = new Buffer(length+4);

  result.writeUInt32LE(length, 0);
  result.write(text, 4);

  return result;
}

function findChunk(data, chunkNum) {
  const result = {};
  const buffer = new Buffer(data);

  processHeader(buffer, result);

  let chunkCount = 0;
  let chunk = {
    endIndex: result.headerLength,
  };

  while (null !== (chunk = getChunk(buffer, chunk.endIndex))) {
    if (chunkCount === chunkNum) {
      return chunk;
    }

    chunkCount++;
  }

  throw new Error('Could not find chunk ' + chunkNum);
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
  const currentString = readString(chunk);

  // create new buffer with new length
  const result = new Buffer(data.length - (currentString.length + 4) + encodedString.length);
  // get buffer before currentString
  data.copy(result, 0, 0, pos);
  // add encodedString to buffer
  encodedString.copy(result, pos);
  // copy the rest of the buffer starting after the existing string
  data.copy(result, pos + encodedString.length, pos + currentString.length + 4);

  return result;
}
