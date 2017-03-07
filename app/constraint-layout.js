var layout = {};
var GAP = 50;
var WIDTH = 20;
var PAD = 1;

/***************************************************************/
/********************** CONSTRAINT LAYOUT **********************/
/***************************************************************/

// Convert the user defined constraints into cola constraints
layout.getConstraints = function() {
  if(renderer.options["debugprint"]) console.log("  Computing cola constraints...");

  layout.sets = {};
  
  // Add an _id to the nodes
  layout.index = -1;
  graph.spec.nodes.map(graph.setID);
  graph.computeBuiltInProperties(graph.spec.constraints);

  // Process the constraints
  var constraints = [].concat.apply([], graph.spec.constraints.map(processConstraint));
  return constraints;
};

// Process each user defined constraint.
function processConstraint(constraint) {
  if(renderer.options["debugprint"]) console.log("    Processing constraint '" + constraint.name + "'...");

  if(constraint.from && !constraint.set) {

    // Handle "between" (aka "from") constraints
    var sets = [];
    constraint.from.forEach(function(constraintName) {
      var newSets = Object.keys(layout.sets[constraintName]).map(function(key) { 
        return layout.sets[constraintName][key]; 
      });
      sets = sets.concat(newSets);
    });
    layout.sets[constraint.name] = generatePairs(sets);

  } else if(!constraint.from && constraint.set) {

    // Handle "within" (aka "set") constraints
    layout.sets[constraint.name] = generateSets(graph.spec.nodes, generateInSetFunc(constraint.set));

  } else {
    console.error("Unknown constraint behavior for: ", constraint);
    return;
  }
  
  var constraints = [];
  Object.keys(layout.sets[constraint.name]).forEach(function(setName) {
    var nodes = layout.sets[constraint.name][setName];
    constraints = constraints.concat(generateConstraints(nodes, constraint.constraints, constraint.name));
  });
  return constraints;
};

// Generate the constraints for each user defined constraint.
function generateConstraints(nodes, constraints, cid) {
  if(renderer.options["debugprint"]) console.log("      Adding cola constraints...");
  var results = [];
  (constraints || []).forEach(function(constraint) {

    var ID = cid + "_" + constraint.type;
    switch(constraint.type) {
      case "align":
        results = results.concat(alignmentConstraint(nodes, constraint, ID));
        break;
      case "order":
        results = results.concat(orderConstraint(nodes, constraint, ID));
        break;
      case "position":
        results = results.concat(positionConstraint(nodes, constraint, ID));
        break;
      default:
        console.error("Unknown constraint type '" + constraint.type + "'");
    };

  });

  return results;
};

/************** Process User Defined Constraints ***************/

function alignmentConstraint(nodes, constraint, cid) {
  var results = [];
  results = results.concat(createColaAlignment(nodes, constraint.axis, cid));
  return results;
};

function orderConstraint(nodes, constraint, cid) {
  var results = [];
  var order = generateOrderFunc(constraint);
  for(var i=0; i<nodes.length; i++) {
    for(var j=i+1; j<nodes.length; j++) {
      if(order(nodes[i], nodes[j])) {
        results.push(createColaPosition(nodes[i], nodes[j], constraint.axis, cid));
      } else {
        results.push(createColaPosition(nodes[j], nodes[i], constraint.axis, cid));
      }
    };
  };
  return results;
};

function positionConstraint(nodes, constraint, cid) {
  var results = [];

  // Create the temporary node
  var node = nodes[0].parent;
  if(node == null) return []; // There is no parent, so return;
  // var x, y;
  // if(constraint.position == "above" || constraint.position == "below") {
  //   x = 0;
  //   y = node;
  // } else {
  //   x = node;
  //   y = 0;
  // }
  // var node = {"x": x, "y": y, "temp": true}
  // graph.spec.nodes.push(node);
  // node._id = graph.spec.nodes.indexOf(node);

  // Create the position constraints relative to the temp node
  for(var i=0; i<nodes.length; i++) {
    switch(constraint.position) {
      case "left":
        results.push(createColaPosition(nodes[i], node, "x", cid));
        break;
      case "right":
        results.push(createColaPosition(node, nodes[i], "x", cid));
        break;
      case "above":
        results.push(createColaPosition(nodes[i], node, "y", cid));
        break;
      case "below":
        results.push(createColaPosition(node, nodes[i], "y", cid));
        break;
      default:
        console.error("Unknown constraint.position: '" + constraint.position + "'");
    };
  };

  return results;
};

/********************* Determine Node Sets *********************/

function generateOrderFunc(def) {
  var order;
  if(def.order) {
    if(def.reverse) def.order.reverse();
    order = function(n1,n2) {
      return def.order.indexOf(n1[def.by]) < def.order.indexOf(n2[def.by]);
    };
  } else if(def.reverse) {
    order = function(n1,n2) {
      return n1[def.by] > n2[def.by];
    };
  } else {
    order = function(n1,n2) {
      return n1[def.by] <= n2[def.by];
    };
  }
  return order;
};

function generateInSetFunc(def) {
  var inSet;

  if(!def) {

    // Create a function to include all nodes in one set.
    inSet = function(node) { return true; };
  
  } else if(!def.property) { 

    // Create a function to partition nodes into the user defined sets
    inSet = function(node) {
      var sets = [];
      def.forEach(function(obj) {
        var value = evaluate(obj.expr, node);
        if(value) sets.push(obj.name || obj.expr);
      });
      if(sets.length > 1) console.error("Node '" + node + "' is included in multiple sets. Nodes can only be in one set per constraint definition.");
      return sets[0] || -1;
    };

  } else if(def.property) {

    // Create a function to partition nodes based on "def.property".
    inSet = function(node) {
      var value = node[def.property];
      if(value != null && typeof value == "object") value = value._id;
      return value;
    };

  } else {
    console.error("Unknown set definition: " + def);
  }

  return inSet;
};

function generatePairs(sets) {
  if(renderer.options["debugprint"]) console.log("      Computing pairs...");
  var pairs = {};
  for(var i=0; i<sets.length; i++) {
    for(var j=i; j<sets.length; j++) {
        
      for(var n1=0; n1<sets[i].length; n1++) {
        for(var n2=0; n2<sets[j].length; n2++) {
          var key = JSON.stringify(sets[i][n1]._id) + JSON.stringify(sets[j][n2]._id);
          pairs[key] = [sets[i][n1], sets[j][n2]];
        };
      };

    };
  };
  return pairs;
};

// Partition nodes into sets based on inSet
function generateSets(nodes, inSet) {
  if(renderer.options["debugprint"]) console.log("      Computing sets...");

  var sets = {};
  nodes.forEach(function(node) {
    var set = inSet(node);
    if(set == -1) return;
    var current = sets[set] || [];
    current.push(node);
    sets[set] = current;
  });
  
  return sets;
};

function value(expr, node) {
  var result = node;
  if(expr.indexOf("datum") != -1) {
    expr = expr.replace(" ", "");
    var props = expr.split(".");
    for (var i = 1; i < props.length; i++) {
      result = result[props[i]];
    };
  } else if(expr.indexOf("'") != -1) {
    
    var split = expr.split(/(')/g);
    var index = 0;
    while(split[index] != "'") {
      index += 1;
    }
    result = split[index+1];

  } else if(expr.indexOf("\"") != -1) {

    var split = expr.split(/(\")/g);
    var index = 0;
    while(split[index] != "\"") {
      index += 1;
    }
    result = split[index+1];

  } else {
    expr = expr.replace(" ", "");

    if(expr == "true") {
      result = true;
    } else if(expr == "false") {
      result = false;
    } else if(!isNaN(Number(expr))) {
      result = Number(expr);
    } else {
      result = expr;
    }

  }
  return result;
};

function evaluate(expr, node) {
  if(renderer.options["debugprint"]) console.log("        Evaluating expr ('" + expr + "') on node ('" + node + "')");
  var andor = expr.split(/(\|\||&&)/g);
  var comp = expr.split(/(==|<=|>=|<|>|!=)/g);

  var result;
  if(andor.length == 1 && comp.length == 1) { 

    result = value(expr, node);

  } else if(andor.length == 1 && comp.length == 3) {
  
    switch(comp[1]) {
      case "==":
        result = value(comp[0], node) == value(comp[2], node);
        break;
      case "!=":
        result = value(comp[0], node) != value(comp[2], node);
        break;
      case "<=":
        result = value(comp[0], node) <= value(comp[2], node);
        break;
      case ">=":
        result = value(comp[0], node) >= value(comp[2], node);
        break;
      case "<":
        result = value(comp[0], node) < value(comp[2], node);
        break;
      case ">":
        result = value(comp[0], node) > value(comp[2], node);
        break;
      default:
        console.error("Unknown operator: " + comp[1]);
    }

  } else if(andor.length > 1) {

    result = evaluate(andor[0], node);
    for (var i = 1; i < andor.length; i=i+2) {
      switch(andor[i]) {
        case "&&":
          result = result && evaluate(andor[i+1], node);
          break;
        case "||":
          result = result || evaluate(andor[i+1], node);
          break;
        default:
          console.error("Unknown conjunction in evaluate: " + andor[i]);
      }

    };

  } else {
    if(comp.length != 3) console.error("Invalid expr: '" + expr + "'");
  }

  return result;
};

/****************** Generate Cola Constraints ******************/

// Create a cola alignment constraint
function createColaAlignment(nodes, axis, cid) {
  var constraint = {
    "type": "alignment",
    "axis": (axis == "x") ? "y" : "x",
    "offsets": [],
    "_type": cid
  };
  nodes.forEach(function(node) {
    constraint.offsets.push({"node": node._id, "offset": 0});
  });
  return constraint;
};

// Create a cola position constraint
function createColaPosition(left, right, axis, cid) {
  var constraint = {
    "axis": axis,
    "left": graph.spec.nodes.indexOf(left),
    "right": graph.spec.nodes.indexOf(right),
    "gap": GAP,
    "_type": cid
  };
  return constraint;
};
