'use strict';

const parser = require('./parser.js');
const fs = require('fs');
const assert = require('assert');


describe('Parser', () => {
  it('Parses generic data correctly', () => {
    const data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    const result = parser.parse(data);

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

    result.civilizations.forEach((s) => {
      assert.notEqual([1, 2, 3].indexOf(s.type), -1);
      assert.equal(s.color.indexOf('PLAYERCOLOR_'), 0);
    });
  });

  describe('Can Change Civ Password', () => {
    const ccpTest = (filename) => {
      const newPassword = 'testing';
      const changePosition = 3;

      const data = fs.readFileSync(filename);
      const changePasswordResult = parser.changeCivPassword(data, changePosition, newPassword);
      const result = parser.parse(changePasswordResult);
      assert.equal(result.civilizations[changePosition].password, newPassword);
    };

    it('normal', () => ccpTest('./saves/newSlack19-before.Civ5Save'));
    it('turn 64', () => ccpTest('./saves/turn64.Civ5Save'));
    it('beyond earth', () => ccpTest('./saves/beyondearth.CivBESave'));
    it('beyond earth turn 64', () => ccpTest('./saves/000129.CivBESave'));
  });

  describe('Can Change Player Name', () => {
    const cpnTest = (filename) => {
      const newName = 'newname';
      const changePosition = 3;

      const data = fs.readFileSync(filename);
      const changePlayerNameResult = parser.changePlayerName(data, changePosition, newName);
      const result = parser.parse(changePlayerNameResult);
      assert.equal(result.civilizations[changePosition].playerName, newName);
    };

    it('normal', () => cpnTest('./saves/newSlack19-before.Civ5Save'));
    it('turn 64', () => cpnTest('./saves/turn64.Civ5Save'));
    it('beyond earth', () => cpnTest('./saves/beyondearth.CivBESave'));
    it('beyond earth turn 64', () => cpnTest('./saves/000129.CivBESave'));
  });

  describe('Can Change Civ Type', () => {
    const cctTest = (filename) => {
      const changePosition = 2;
      const changeValue = 1;

      const data = fs.readFileSync(filename);
      const changeCivTypeResult = parser.changeCivType(data, changePosition, changeValue);
      const result = parser.parse(changeCivTypeResult);

      assert.equal(result.civilizations[changePosition].type, changeValue);
    };

    it('normal', () => cctTest('./saves/newSlack19-before.Civ5Save'));
    it('turn 64', () => cctTest('./saves/turn64.Civ5Save'));
    it('beyond earth', () => cctTest('./saves/beyondearth.CivBESave'));
    it('beyond earth turn 64', () => cctTest('./saves/000129.CivBESave'));
  });

  describe('Can Change Current Player Index', () => {
    const ccpiTest = (filename) => {
      const newPlayer = 1;

      const data = fs.readFileSync(filename);
      const changeCivTypeResult = parser.changePlayer(data, newPlayer);
      const result = parser.parse(changeCivTypeResult);

      assert.equal(result.player, newPlayer);
    };

    it('normal', () => ccpiTest('./saves/newSlack19-before.Civ5Save'));
    it('turn 64', () => ccpiTest('./saves/turn64.Civ5Save'));
    it('beyond earth', () => ccpiTest('./saves/beyondearth.CivBESave'));
    it('beyond earth turn 64', () => ccpiTest('./saves/000129.CivBESave'));
  });

  it('Can parse beyond earth', () => {
    const data = fs.readFileSync('./saves/beyondearth.CivBESave');
    const result = parser.parse(data);

    assert.equal(result.civ, 'CIVBE');
    assert.equal(result.save, 2);
    assert.equal(result.game, '1.1.2.4035 ');
    assert.equal(result.build, '');
    assert.equal(result.turn, 0);
    assert.equal(result.startingCiv, 'CIVILIZATION_ARC');
    assert.equal(result.handicap, 'HANDICAP_SPUTNIK');
    assert.equal(result.era, 'ERA_ANCIENT');
    assert.equal(result.gameSpeed, 'GAMESPEED_QUICK');
    assert.equal(result.worldSize, 'WORLDSIZE_SMALL');
    assert.equal(result.mapScript, 'Assets\\Maps\\Protean.lua');

    assert.equal(result.civilizations.length, 8);
    assert.equal(result.barbarianCount, 0);
    assert.equal(result.player, 1);

    result.civilizations.forEach((s) => {
      assert.notEqual([1, 2, 3].indexOf(s.type), -1);
      assert.equal(s.color.indexOf('PLAYERCOLOR_'), 0);
    });
  });

  it('Correctly throws error on bad save', () => {
    const data = fs.readFileSync('./saves/bad.Civ5Save');
    assert.throws(() => parser.parse(data));
  });

  it('Parses Turn 64', () => {
    const data = fs.readFileSync('./saves/turn64.Civ5Save');
    const result = parser.parse(data);

    assert.equal(result.civ, 'CIV5');
    assert.equal(result.save, 8);
    assert.equal(result.game, '1.0.3.279 (403694)');
    assert.equal(result.build, '403694');
    assert.equal(result.turn, 64);
    assert.equal(result.startingCiv, 'CIVILIZATION_GREECE');
    assert.equal(result.handicap, 'HANDICAP_PRINCE');
    assert.equal(result.era, 'ERA_ANCIENT');
    assert.equal(result.gameSpeed, 'GAMESPEED_QUICK');
    assert.equal(result.worldSize, 'WORLDSIZE_TINY');
    assert.equal(result.mapScript, 'Assets\\Maps\\Continents.lua');

    assert.equal(result.civilizations.length, 13);
    assert.equal(result.barbarianCount, 9);
    assert.equal(result.player, 0);

    result.civilizations.forEach((s) => {
      assert.notEqual([1, 2, 3].indexOf(s.type), -1);
      assert.equal(s.color.indexOf('PLAYERCOLOR_'), 0);
    });
  });

  it('Parses Beyond Earth Turn 64', () => {
    const data = fs.readFileSync('./saves/000129.CivBESave');
    const result = parser.parse(data);

    assert.equal(result.civ, 'CIVBE');
    assert.equal(result.save, 2);
    assert.equal(result.game, '1.1.2.4035 ');
    assert.equal(result.build, '');
    assert.equal(result.turn, 64);
    assert.equal(result.startingCiv, 'CIVILIZATION_KAVITHAN');
    assert.equal(result.handicap, 'HANDICAP_MERCURY');
    assert.equal(result.era, 'ERA_ANCIENT');
    assert.equal(result.gameSpeed, 'GAMESPEED_QUICK');
    assert.equal(result.worldSize, 'WORLDSIZE_SMALL');
    assert.equal(result.mapScript, 'Assets\\Maps\\Protean.lua');

    assert.equal(result.civilizations.length, 8);
    assert.equal(result.barbarianCount, 0);
    assert.equal(result.player, 0);

    result.civilizations.forEach((s) => {
      assert.notEqual([1, 2, 3].indexOf(s.type), -1);
      assert.equal(s.color.indexOf('PLAYERCOLOR_'), 0);
    });
  });

  it('Can handle diacritics appropriately', () => {
    let data = fs.readFileSync('./saves/newSlack19-before.Civ5Save');
    data = parser.changePlayerName(data, 0, 'Míké Rósáck');
    const parsed = parser.parse(data);
    assert.equal(parsed.civilizations[0].playerName, 'Mike Rosack');
  });
});
