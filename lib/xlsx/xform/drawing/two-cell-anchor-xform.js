'use strict';

var utils = require('../../../utils/utils');
var colCache = require('../../../utils/col-cache');
var BaseXform = require('../base-xform');
var StaticXform = require('../static-xform');
var Anchor = require('../../../doc/anchor');

var CellPositionXform = require('./cell-position-xform');
var PicXform = require('./pic-xform');

var TwoCellAnchorXform = module.exports = function() {
  this.map = {
    'xdr:from': new CellPositionXform({tag: 'xdr:from'}),
    'xdr:to': new CellPositionXform({tag: 'xdr:to'}),
    'xdr:pic': new PicXform(),
    'xdr:clientData': new StaticXform({tag: 'xdr:clientData'}),
  };
};

utils.inherits(TwoCellAnchorXform, BaseXform, {
  get tag() { return 'xdr:twoCellAnchor'; },

  prepare: function(model, options) {
    this.map['xdr:pic'].prepare(model.picture, options);

    // convert model.range into tl, br
    if (typeof model.range === 'string') {
      var range = colCache.decode(model.range);
      // Note - zero based
      model.tl = CellPositionXform.buildModel({
        nativeCol: range.left - 1,
        nativeRow: range.top - 1
      });
      // zero based but also +1 to cover to bottom right of br cell
      model.br = CellPositionXform.buildModel({
        nativeCol: range.right,
        nativeRow: range.bottom
      });
    } else {
      model.range.tl = Anchor.asInstance(model.range.tl);
      model.range.br = Anchor.asInstance(model.range.br);
      model.tl = model.range.tl;
      model.br = model.range.br;
    }
  },

  render: function(xmlStream, model) {
    if (model.range.editAs) {
      xmlStream.openNode(this.tag, {editAs: model.range.editAs});
    } else {
      xmlStream.openNode(this.tag);
    }

    this.map['xdr:from'].render(xmlStream, model.tl);
    this.map['xdr:to'].render(xmlStream, model.br);
    this.map['xdr:pic'].render(xmlStream, model.picture);
    this.map['xdr:clientData'].render(xmlStream, {});

    xmlStream.closeNode();
  },

  parseOpen: function(node) {
    if (this.parser) {
      this.parser.parseOpen(node);
      return true;
    }
    switch (node.name) {
      case this.tag:
        this.reset();
        this.model = {
          editAs: node.attributes.editAs
        };
        break;
      default:
        this.parser = this.map[node.name];
        if (this.parser) {
          this.parser.parseOpen(node);
        }
        break;
    }
    return true;
  },

  parseText: function(text) {
    if (this.parser) {
      this.parser.parseText(text);
    }
  },

  parseClose: function(name) {
    if (this.parser) {
      if (!this.parser.parseClose(name)) {
        this.parser = undefined;
      }
      return true;
    }
    switch (name) {
      case this.tag:
        this.model = this.model || {};
        this.model.tl = this.map['xdr:from'].model;
        this.model.br = this.map['xdr:to'].model;
        this.model.picture = this.map['xdr:pic'].model;
        return false;
      default:
        // could be some unrecognised tags
        return true;
    }
  },

  reconcile: function(model, options) {
    if (model.picture && model.picture.rId) {
      var rel = options.rels[model.picture.rId];
      var match = rel.Target.match(/.*\/media\/(.+[.][a-z]{3,4})/);
      if (match) {
        var name = match[1];
        var mediaId = options.mediaIndex[name];
        model.medium = options.media[mediaId];
      }
    }

    model.tl = Anchor.asInstance(model.tl);
    model.br = Anchor.asInstance(model.br);

    if (model.tl && model.br && Number.isInteger(model.tl.row) && Number.isInteger(model.tl.col) && Number.isInteger(model.br.row) && Number.isInteger(model.br.col)) {
      model.range = colCache.encode(model.tl.row + 1, model.tl.col + 1, model.br.row, model.br.col);
    } else {
      model.range = {
        tl: model.tl,
        br: model.br,
      };
    }
    if (model.editAs) {
      model.range.editAs = model.editAs;
      delete model.editAs;
    }
    delete model.tl;
    delete model.br;
  }
});
