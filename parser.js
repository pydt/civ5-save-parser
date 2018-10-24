'use strict';

module.exports = {
  parse: function(data){
    const result = {};
    const buffer = new Buffer(data);

    // Process header information
    processHeader(buffer, result);

    let chunkCount = 0;
    let chunk = {
      endIndex: 0
    };

    result.civilizations = [];
    while (null !== (chunk = getChunk(buffer, chunk.endIndex))) {
      // 1st chunk contains player names
      if (chunkCount === 1){
        while(chunk.pos < chunk.buffer.length){
          result.civilizations.push({
            playerName: readString(chunk)
          });
        }
      }

      // 2nd chunk contains the type/status of civilization - 1 alive, 2 dead, 3 human, 4 missing
      if (chunkCount === 2){
        let i = 0;
        while(chunk.pos < chunk.buffer.length){
          result.civilizations[i].type = readInt(chunk);
          i++;
        }
      }

      // 6th chunk contains all civ names 
      if (chunkCount === 6){
        let i = 0;
        while(chunk.pos < chunk.buffer.length){
          let civ = readString(chunk);
          if(civ.trim() !== ''){
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
        while(chunk.pos < chunk.buffer.length && i < result.civilizations.length){
          result.civilizations[i].leader = readString(chunk);
          if(result.civilizations[i].leader === 'LEADER_BARBARIAN'){
            result.barbarianCount++;
          }
          i++;
        }
        // Look 4 bytes backwards from end of chunk for the current player...
        result.player = chunk.buffer.readUInt32LE(chunk.buffer.length - 16);
      }

      // 11th chunk contains passwords
      if (chunkCount === 11){
        let i = 0;
        while(chunk.pos < chunk.buffer.length && i < result.civilizations.length){
          result.civilizations[i].password = readString(chunk);
          i++;
        }
      }

      // 23rd chunk contains player colors
      if (chunkCount === 23){
        // Read through player colors
        let i = 0;
        while(chunk.pos < chunk.buffer.length && i < result.civilizations.length){
          result.civilizations[i].color = readString(chunk);
          i++;
        }
      }
      chunkCount++;
    }

    //remove missing civs (status 4)
    for(let i = result.civilizations.length-1; i >= 0; i--) {
      if(!result.civilizations[i].name || result.civilizations[i].type === 4) {
        result.civilizations.splice(i, 1);
      }
    }

    return result;
  },
  changeCivType: function(data, position, type){
      const buffer = new Buffer(data);
      let result = new Buffer(data);

      let chunkCount = 0;
      let chunk = {
        endIndex: 0
      };

      while (null !== (chunk = getChunk(buffer, chunk.endIndex))) {
        // either the 2nd or the 26th chunk contains the type/status of civilization - 1 alive, 2 dead, 3 human, 4 missing
        if (chunkCount === 2 || chunkCount === 26){
          let civCount = 0;
          let abort = false;
          while(chunk.pos < chunk.buffer.length){
            if(civCount === position){
              let pos = chunk.startIndex + chunk.pos;
              let civType = result.slice(pos, pos + 4);
              civType.writeUInt32LE(type, 0 );
            }

            readInt(chunk);
            civCount++;
          }
        }
        
        chunkCount++;
      }

      return result;
  },
  changeCivPassword: function(data, position, password){
    return writeString(data, 11, position, password);
  },
  changePlayerName: function(data, position, playerName){
    return writeString(data, 1, position, playerName);
  }
};

// Parse helper functions

function getChunk(buffer, startIndex) {
  const delimiter = new Buffer([0x40, 0, 0, 0]);
  const result = {
    startIndex: startIndex,
    pos: 0
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

function processHeader(buffer, result){
  let pos = 0;
  let buf = {
    buffer: buffer,
    pos: 0
  }
  result.civ = readString(buf, 4);
  result.save = readInt(buf);
  result.game = readString(buf);
  result.build = readString(buf);
  result.turn = readInt(buf);
  //TODO: investigate this Byte
  skipBytes(buf, 1);
  result.startingCiv = readString(buf);
  result.handicap = readString(buf);
  result.era = readString(buf);
  result.currentEra = readString(buf);
  result.gameSpeed = readString(buf);
  result.worldSize = readString(buf);
  result.mapScript = readString(buf);
}

function readString(buf, length){
  let result = [];
  if(!length){
    length = readInt(buf);
    if(length === 0 || length > 1000)
      return '';
  }
  
  for(let i=0; i<length; i++){
    result.push(buf.buffer[buf.pos]);
    buf.pos++;
  }

  let resBuf = new Buffer(result);
  return resBuf.toString();
}

function readInt(buf){
  let int = buf.buffer.readUInt32LE(buf.pos);
  buf.pos+=4;
  return int;
}

function skipBytes(buf, num){
  buf.pos += num;
}

// Write helper functions
function encodeString(text){
  let length = text.length;
  let result = new Buffer(length+4);

  result.writeUInt32LE(length, 0);
  result.write(text, 4);

  return result;
}

function writeString(data, chunkNum, position, newString){
  const buffer = new Buffer(data);
  let result;

  let chunkCount = 0;
  let chunk = {
    endIndex: 0
  };

  while (null !== (chunk = getChunk(buffer, chunk.endIndex))) {
    if (chunkCount === chunkNum){
      for(let i=0; i<position; i++){
        readString(chunk);
      }
      let pos = chunk.startIndex + chunk.pos;
      let encodedString = encodeString(newString);
      let currentString = readString(chunk);

      //create new buffer with new length
      result = new Buffer(buffer.length - (currentString.length + 4) + encodedString.length);
      //get buffer before currentString
      buffer.copy(result, 0, 0, pos);
      //add encodedString to buffer
      encodedString.copy(result, pos);
      //copy the rest of the buffer starting after the existing string 
      buffer.copy(result, pos + encodedString.length, pos + currentString.length + 4);
    }

    chunkCount++;
  }

  return result;
}