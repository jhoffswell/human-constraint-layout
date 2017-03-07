var graph = {};

/***************************************************************/
/**************************** GRAPH ****************************/
/***************************************************************/

graph.init = function(spec) {
  graph.spec = spec;
  graph.hidden_constraints = [];

  // Set graph options
  var type = graph.spec.nodes[0][renderer.options["fillprop"]];
  graph.color = (typeof type == "string") ? d3.scaleOrdinal(d3.schemeDark2) : d3.scaleSequential(d3.interpolateYlGnBu);
};

graph.computeBuiltInProperties = function(constraint) {
  if(JSON.stringify(constraint).indexOf("depth") != -1) calculateDepths();
  if(JSON.stringify(constraint).indexOf("parent") != -1) calculateParents();
};

function calculateDepths() {
  graph.spec.nodes.forEach(function(node) {
    node.depth = node.depth || graph.getDepth(node);
  });
};

function calculateParents() {
  graph.spec.nodes.forEach(function(node) {
    node.parent = node.parent || graph.getParent(node);
  });
};

/*********************** Node Properties ***********************/

graph.setSize = function(node) {
  node.width = node.width || renderer.options["nodesize"];
  node.height = node.height || renderer.options["nodesize"];
};

graph.setID = function(node) {
  node._id = node._id || graph.spec.nodes.indexOf(node);
};

graph.getLabel = function(node) {
  return node[renderer.options["labelprop"]] || node.name || node._id;
};

graph.setColor = function(node) {
  var value = node[renderer.options["fillprop"]] || 0.5;
  if(typeof value == "number") {
    var max = Math.max(...graph.spec.nodes.map(function(n) { return n[renderer.options["fillprop"]] || 0.5; }));
    node.color = node.color || graph.color(value / max);
  } else {
    node.color = node.color || graph.color(value);
  }
};

graph.getColor = function(node) {
  var value = node[renderer.options["fillprop"]] || 0.5;
  return node.color || graph.color(value);
};

// TODO: This will not work on cyclic graphs!!
graph.getDepth = function(node) {
  var index = node._id;
  var incoming = graph.spec.links.filter(function(link) { return link.target == index; });
  var depth = 0;
  if(incoming.length > 0) {
    var parentDepths = incoming.map(function(link) { 
      var parent = graph.spec.nodes[link.source];
      return parent.depth || graph.getDepth(parent);
    });
    depth = Math.max(parentDepths) + 1;
  }
  return depth;
};

// TODO: This will be an issue if a node has more than one parent.
graph.getParent = function(node) {
  var parent = null;
  var index = node._id;
  var incoming = graph.spec.links.filter(function(link) { return link.target == index; });
  if(incoming.length == 1) {
    parent = graph.spec.nodes[incoming[0].source];
  } else if(incoming.length > 1) {
    parent = graph.spec.nodes[incoming[0].source];
    console.error("getParent(node): " + node + " has more than one parent.");
  }
  return parent;
};