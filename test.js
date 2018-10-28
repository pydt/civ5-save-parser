'use strict';

const parser = require('./parser.js');
const fs = require('fs');
const assert = require('assert');


describe('Parser', () => {
  it('Parses generic data correctly', () => {
    let data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    let result = parser.parse(data);
  
    assert.equal(result.civ, 'CIV5');
    assert.equal(result.save, 8);
    assert.equal(result.game, '1.0.3.279 (403694)');
    assert.equal(result.build, '403694');
    assert.equal(result.turn, 19);
    assert.equal(result.startingCiv, 'CIVILIZATION_INDIA');
    assert.equal(result.handicap, 'HANDICAP_PRINCE');
    assert.equal(result.era, 'ERA_ANCIENT');
    assert.equal(result.gameSpeed, 'GAMESPEED_QUICK');
    assert.equal(result.worldSize, 'WORLDSIZE_STANDARD');
    assert.equal(result.mapScript, 'Assets\\Maps\\Continents.lua');

    assert.equal(result.civilizations.length, 25);
    assert.equal(result.barbarianCount, 17);
    assert.equal(result.player, 4);
    assert.equal(result.civilizations[4].password, 'berlin');

    result.civilizations.forEach(function(s) {
      assert.notEqual([1,2,3].indexOf(s.type), -1);
    });
  });

  it('Can Change Civ Password', function() {
    const newPassword = "testing";
    const changePosition = 4;

    const data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    const changePasswordResult = parser.changeCivPassword(data, changePosition, newPassword);
    const result = parser.parse(changePasswordResult);
    assert.equal(result.civilizations[changePosition].password, newPassword);
  });

  it('Can Change Player Name', function() {
    const newName = "newname";
    const changePosition = 4;

    const data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    const changePasswordResult = parser.changePlayerName(data, changePosition, newName);
    const result = parser.parse(changePasswordResult);
    assert.equal(result.civilizations[changePosition].playerName, newName);
  });

  it('Can Change Civ Type', function() {
    const changePosition = 2;
    const changeValue = 1; 

    const data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    const changeCivTypeResult = parser.changeCivType(data, changePosition, changeValue);
    const result = parser.parse(changeCivTypeResult);

    assert.equal(result.civilizations[changePosition].type, changeValue);
  });

  it('Can Change Current Player Index', function() {
    const newPlayer = 1;

    const data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    const changeCivTypeResult = parser.changePlayer(data, newPlayer);
    const result = parser.parse(changeCivTypeResult);

    assert.equal(result.player, newPlayer);
  });
});