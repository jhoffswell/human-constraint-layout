/*****************************************************/
/********************** Default **********************/
/*****************************************************/
var styling = {};

  styling.dx = function(d) { 
    return d.width/2 - 7;
  };

  styling.dy = function(d) { 
    return d.width/2 + 4;
  };

  styling.label = function(d) {
    return d.name;
  };

  styling.size = function(d) {
    return '12pt';
  };

  styling.style = function(d) {
    return 'italic';
  };

  styling.color = function(d) {
    return 'white';
  };

  styling.nodeStroke = function(d) {
    return 'white';
  };

/*****************************************************/
/****************** Small Food Web *******************/
/*****************************************************/
var kruger = {};

  kruger.dx = function(d) { 
    var pad = d.pad || renderer.options["nodepad"];
    var nodeWidth = d.width - 2*pad;
    var offset = this.getBBox().width/2;

    return nodeWidth/2 - offset;
  };

  kruger.dy = function(d) { 
    var pad = d.pad || renderer.options["nodepad"];
    return (d.height - 2*pad)/2;
  };

  kruger.label = function(d) {
    // return '';
    return d.name;
  };

  kruger.size = function(d) {
    return '5pt';
  };

  kruger.style = function(d) {
    return 'regular';
  };

  kruger.color = function(d) {
    return 'black';
  };

  kruger.nodeStroke = function(d) {
    return 'white';
  };

/*****************************************************/
/********************* Serengeti *********************/
/*****************************************************/
var serengeti = {};

  serengeti.dx = function(d) { 
    if(d.group1 <= 6) return d.size + 1;
    return d.size/2 - 5;
  };

  serengeti.dy = function(d) { 
    if(d.group1 <= 6) return d.size/2 + 7; 
    return d.size/2 + 5;
  };

  serengeti.label = function(d) {
    var string = ''
    if(!d.species) {
      // Do nothing.
    } else if(d.group1 <= 6) {
      var split = d.species.split(' ');
      string = split[0].slice(0,1) + '. ' + split[1];
    } else {
      string = d.habitat ? d.habitat.slice(0,1) : '--';
    }
    
    return string;
  };

  serengeti.size = function(d) {
    if(d.group1 <= 6) return '14pt';
    return '10pt';
  };

  serengeti.style = function(d) {
    if(d.group1 <= 6) return 'italic';
    return 'normal';
  };

  serengeti.color = function(d) {
    return 'black';
  };

  serengeti.nodeStroke = function(d) {
    return 'white';
  };

/*****************************************************/
/********************* Syphilis **********************/
/*****************************************************/
var syphilis = {};

  syphilis.dx = function(d) { 
    var offset = 11;
    var pad = d.pad || renderer.options["nodepad"];
    if((d.width-2*pad) === 24) offset = 7;
    return (d.width - 2*pad)/2 - offset;
  };

  syphilis.dy = function(d) { 
    var pad = d.pad || renderer.options["nodepad"];
    return (d.height - 2*pad)/2 + 5;
  };

  syphilis.label = function(d) {
    return d.name;
  };

  syphilis.size = function(d) {
    return '9pt';
  };

  syphilis.style = function(d) {
    return 'regular';
  };

  syphilis.color = function(d) {
    return 'black';
  };

  syphilis.nodeStroke = function(d) {
    return 'white';
  };

/*****************************************************/
/*********************** TLR4 ************************/
/*****************************************************/
var tlr4 = {};

  tlr4.dx = function(d) { 
    var offset = this.getBBox().width/2 -4;
    var pad = d.pad || renderer.options["nodepad"];
    return (d.width - 2*pad)/2 - offset;
  };

  tlr4.dy = function(d) { 
    return 35;
  };

  tlr4.label = function(d) {
    return d.showLabel;
  };

  tlr4.size = function(d) {
    return '9pt';
  };

  tlr4.style = function(d) {
    return 'regular';
  };

  tlr4.color = function(d) {
    return 'black';
  };

  tlr4.nodeStroke = function(d) {
    return '#bbb';
  };