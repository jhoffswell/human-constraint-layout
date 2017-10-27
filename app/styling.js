/*****************************************************/
/********************** Default **********************/
/*****************************************************/
var styling = {};

styling.x = function(d) { 
  return d.size + 1;
};

styling.y = function(d) { 
  return d.size/2 + 5;
};

styling.label = function(d) {
  return d.name;
};

styling.size = function(d) {
  return '14pt';
};

styling.style = function(d) {
  return 'italic';
};

/*****************************************************/
/********************* Serengeti *********************/
/*****************************************************/
var serengeti = {};

serengeti.x = function(d) { 
  if(d.group1 <= 6) return d.size + 1;
  return d.size/2 - 5;
};

serengeti.y = function(d) { 
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