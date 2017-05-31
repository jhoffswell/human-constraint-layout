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
  if(JSON.stringify(constraint).indexOf("parents") != -1) calculateIncoming();
  if(JSON.stringify(constraint).indexOf("parent") != -1) calculateParents();
  if(JSON.stringify(constraint).indexOf("children") != -1) calculateOutgoing();
  if(JSON.stringify(constraint).indexOf("neighbors") != -1) calculateNeighbors();
  if(JSON.stringify(constraint).indexOf("degree") != -1) calculateDegree();
  if(JSON.stringify(constraint).indexOf("firstchild") != -1) calculateFirstChild();
};

graph.removeTempNodes = function() {
  graph.spec.nodes = graph.spec.nodes.filter(function(node) {
    return node.temp == null;
  });
};

function calculateDepths() {
  if(renderer.options["debugprint"]) console.log("        Computing depths.");
  // graph.spec.nodes.forEach(function(node) {
  //   node.depth = node.depth || graph.getDepth(node);
  // });
  var root = graph.spec.nodes[0];
  root.depth = 0;
  calculateDepthFromRoot(root);
};

// Note: This can ignore cycles (because it gets the depth)
// as a min based on when it was visited. It currently does not
// do disconnected graphs.
function calculateDepthFromRoot(root) {
  // Find the nodes that are outgoing from this node.
  var index = root._id;
  var outgoing = graph.spec.links.filter(function(link) { return link.source == index; });
  var calculate = outgoing.map(function(link) { return graph.spec.nodes[link.target]; })
      .filter(function(node) { return !node.depth; });

  // Compute the depth and recurse
  calculate.forEach(function(node) {
    node.depth = node.depth || root.depth + 1;
    calculateDepthFromRoot(node);
  });
};

function calculateParents() {
  if(renderer.options["debugprint"]) console.log("        Computing parents.");
  graph.spec.nodes.forEach(function(node) {
    node.parent = node.parent || graph.getParent(node);
  });
};

function calculateIncoming() {
  if(renderer.options["debugprint"]) console.log("        Computing incoming.");
  graph.spec.nodes.forEach(function(node) {
    node.incoming = node.incoming || graph.getIncoming(node);
  });
};

function calculateOutgoing() {
  if(renderer.options["debugprint"]) console.log("        Computing outgoing.");
  graph.spec.nodes.forEach(function(node) {
    node.outgoing = node.outgoing || graph.getOutgoing(node);
  });
};

function calculateNeighbors() {
  if(renderer.options["debugprint"]) console.log("        Computing neighbors.");
  graph.spec.nodes.forEach(function(node) {
    node.neighbors = node.neighbors || graph.getNeighbors(node);
  });
};

function calculateDegree() {
  if(renderer.options["debugprint"]) console.log("        Computing degree.");
  graph.spec.nodes.forEach(function(node) {
    node.degree = node.degree || graph.getDegree(node);
  });
};

function calculateFirstChild() {
  if(renderer.options["debugprint"]) console.log("        Computing first child.");
  graph.spec.nodes.forEach(function(node) {
    node.firstchild = node.firstchild || graph.getFirstChild(node);
  });
};

/********************* Set Node Properties *********************/

graph.setSize = function(node) {
  var pad = renderer.options["nodepad"];
  node.width = renderer.options["nodesize"] + 2*pad;
  node.height = renderer.options["nodesize"] + 2*pad;
  node.padding = pad;
};

graph.setID = function(node) {
  node._id = node._id || graph.spec.nodes.indexOf(node);
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

/********************* Get Node Properties *********************/

graph.getLabel = function(node) {
  return node[renderer.options["labelprop"]] || node.name || node._id;
};

graph.getColor = function(node) {
  var value = node[renderer.options["fillprop"]] || 0.5;
  return node.color || graph.color(value);
};

// TODO: This will not work on cyclic graphs!!
graph.getDepth = function(node) {
  if(node.depth) return node.depth;

  // Calculate the depth
  var index = node._id;
  var incoming = graph.spec.links.filter(function(link) { return link.target == index; });
  var depth = 0;
  if(incoming.length > 0) {
    var parentDepths = incoming.map(function(link) { 
      var parent = graph.spec.nodes[link.source];
      return parent.depth || graph.getDepth(parent);
    }).filter(function(d) { return !isNaN(d); });

    depth = Math.min(parentDepths) + 1;
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

graph.getIncoming = function(node) {
  var index = node._id;
  var incoming = graph.spec.links.filter(function(link) { return link.target == index; });
  return incoming;
};

graph.getOutgoing = function(node) {
  var index = node._id;
  var outgoing = graph.spec.links.filter(function(link) { return link.source == index; });
  return outgoing;
};

graph.getNeighbors = function(node) {
  var incoming = node.incoming || graph.getIncoming(node);
  var outgoing = node.outgoing || graph.getOutgoing(node);
  return incoming.concat(outgoing);
};

graph.getDegree = function(node) {
  var incoming = node.incoming || graph.getIncoming(node);
  var outgoing = node.outgoing || graph.getOutgoing(node);
  return incoming.length + outgoing.length;
};

graph.getFirstChild = function(node) {
  var outgoing = node.outgoing || graph.getOutgoing(node);
  outgoing = outgoing.sort(function(a,b) { return a._id - b._id; });
  if(outgoing.length == 0) return null;
  return graph.spec.nodes[outgoing[0].target];
};
