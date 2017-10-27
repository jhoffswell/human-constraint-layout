var layout = {};

/***************************************************************/
/********************** CONSTRAINT LAYOUT **********************/
/***************************************************************/

// Convert the user defined constraints into cola constraints
layout.getConstraints = function() {
  if(renderer.options["debugprint"]) console.log("  Computing cola constraints...");

  layout.sets = {};
  layout.groups = [];
  
  // Add an _id to the nodes
  layout.index = -1;
  graph.spec.nodes.map(graph.setID);
  graph.computeBuiltInProperties(graph.spec.constraints);
  graph.removeTempNodes();

  // Process the constraints
  var constraints = [].concat.apply([], graph.spec.constraints.map(processConstraint));
  return {"constraints": constraints, "groups": layout.groups};
};

// Process each user defined constraint.
function processConstraint(constraint) {
  if(renderer.options["debugprint"]) console.log("    Processing constraint '" + constraint.name + "'...");

  // Create the sets
  if(constraint.name && constraint.set) {
    var inSet = generateInSetFunc(constraint.set);
    layout.sets[constraint.name] = generateSets(graph.spec.nodes, inSet, constraint.set);
  } else if(constraint.name) {
    layout.sets[constraint.name] = generateSets(graph.spec.nodes, generateInSetFunc(null));
  } else {
    console.error("Unknown constraint behavior for: ", constraint);
    return;
  }

  var constraints = [];

  // Handle "within set" constraints
  if(constraint.name && constraint.within) {
    Object.keys(layout.sets[constraint.name]).forEach(function(setName) {
      var nodes = layout.sets[constraint.name][setName];
      constraints = constraints.concat(generateConstraints(nodes, constraint.within, constraint.name));
    });
  }

  // Handle "between set" constraints
  if(constraint.name && constraint.between) {
    var sets = Object.keys(layout.sets[constraint.name]).map(function(key) { 
      return layout.sets[constraint.name][key]; 
    });
    
    // Identify any group constraints and compute the group constraints
    constraint.between.filter(function(c) { return c.type == "group"; }).forEach(function(c) {
      var groups = [];
      sets.forEach(function(set) {
        var ids = set.map(function(node) { return node._id; });
        var group = {"leaves": ids};
        if(layout.groups.indexOf(group) == -1) {
          layout.groups.push(group);
        }
        groups.push(layout.groups.indexOf(group));
      });
      layout.groups.push({"groups": groups});
    });
    var filtered = constraint.between.filter(function(c) { return c.type != "group"; });

    //TODO TEMP: trying to optimize order constraint
    // filtered.forEach(function(c) { 
    //   var cid = constraint.name + "_" + c.type;
    //   if(c.type == "order") constraints = constraints.concat(orderConstraintFromSets(sets, c, cid)); 
    // });

    // Generate pairs and apply constraints between sets
    var pairs = generatePairs(sets);
    Object.keys(pairs).forEach(function(setName) {
      var nodes = pairs[setName];
      constraints = constraints.concat(generateConstraints(nodes, filtered, constraint.name));
    });
  }

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
      case "circle":
        circleConstraint(nodes, constraint, ID);
        break;
      case "group":
        console.log("don\"t want this anymore...")
        groupConstraint(nodes, constraint, ID);
        break;
      default:
        console.error("Unknown constraint type \"" + constraint.type + "\"");
    };

  });

  return results;
};

/************** Process User Defined Constraints ***************/

function boundaryConstraint(nodes, constraint, cid) {
  var results = [];

  // Create the boundary nodes.
  var topLeft = {"temp": true, "fixed": true, "boundary": "xy"};
  graph.spec.nodes.push(topLeft);
  topLeft._id = graph.spec.nodes.indexOf(topLeft);

  var bottomRight = {"temp": true, "fixed": true, "boundary": "xy"};
  graph.spec.nodes.push(bottomRight);
  bottomRight._id = graph.spec.nodes.indexOf(bottomRight);

  // Create the separation constraints.
  var gap = renderer.options["nodesize"] / 2;
  for(var i=0; i<nodes.length-1; i++) {
    if(nodes[i].width) gap = nodes[i].width / 2;
    results.push(createColaSeparation(topLeft, nodes[i], "x", cid, gap));
    results.push(createColaSeparation(topLeft, nodes[i], "y", cid, gap));
    results.push(createColaSeparation(nodes[i], bottomRight, "x", cid, gap));
    results.push(createColaSeparation(nodes[i], bottomRight, "y", cid, gap));
  }
};

function alignmentConstraint(nodes, constraint, cid) {
  var results = [];
  results = results.concat(createColaAlignment(nodes, constraint.axis, cid));
  return results;
};

function orderConstraint(nodes, constraint, cid) {
  var results = [];
  var order = generateOrderFunc(constraint);

  // Sort the nodes into groups
  nodes = nodes.sort(order);

  // Compute the band for the nodes
  if(constraint.band) {

  }

  // Generate the constraints
  for(var i=0; i<nodes.length-1; i++) {
    results.push(createColaPosition(nodes[i+1], nodes[i], constraint.axis, cid, constraint.gap));
  };
  return results;
};

function orderConstraintFromSets(sets, constraint, cid) {

  var results = [];

  // Compute the order of the sets
  var order = generateOrderFuncSort(constraint);
  var represent = sets.map(function(set) { return set[0]; }).sort(order);

  if(constraint.band) {

    // Create a new node at the barrier of each band
    var barriers = [];
    for(var i = 0; i <= sets.length; i++) {
      var node = {"temp": true, "fixed": true,"cid":cid};
      node.name = i;

      var other = constraint.axis == "x" ? "y" : "x";
      node.boundary = constraint.axis;
      node[constraint.axis] = i*constraint.band;
      node[other] = 0;
      
      barriers.push(node);
      graph.spec.nodes.push(node);
      node._id = graph.spec.nodes.indexOf(node);
    };

    // Compute the constraints to order the nodes
    sets.forEach(function(set) {
      var index = represent.indexOf(set[0]);
      var left = barriers[index];
      var right = barriers[index+1];
      var gap = constraint.gap ? constraint.gap : renderer.options["constgap"];

      set.forEach(function(node) {
        results.push(createColaPosition(left, node, constraint.axis, cid, gap));
        results.push(createColaPosition(node, right, constraint.axis, cid, gap));
      });
    });

  } else {

    // Create a new node at the barrier of each band
    var barriers = [];
    for(var i = 0; i < sets.length-1; i++) {
      var node = {"temp": true,"fixed": true,"cid":cid};
      node.name = i;

      var other = constraint.axis == "x" ? "y" : "x";
      node.boundary = constraint.axis;
      node[constraint.axis] = i*renderer.options["constgap"];
      node[other] = 0;
      
      barriers.push(node);
      graph.spec.nodes.push(node);
      node._id = graph.spec.nodes.indexOf(node);
    };

    // Compute the constraints to order the nodes
    sets.forEach(function(set) {
      var index = represent.indexOf(set[0]);
      var left = barriers[index-1];
      var right = barriers[index];
      var gap = constraint.gap ? constraint.gap : renderer.options["constgap"];

      set.forEach(function(node) {
        if(index != 0) {
          results.push(createColaPosition(left, node, constraint.axis, cid, gap));
        }
        if(index != sets.length-1) {
          results.push(createColaPosition(node, right, constraint.axis, cid, gap));
        }
      });
    });

  }

  return results;

};

function orderConstraint2(nodes, constraint, cid) {
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
  var node;
  switch(constraint.of) {
    case "parent":
      node = nodes[0].parent;
      break;
    case "firstchild":
      node = nodes[0].firstchild;
      break;
    default:
      if(constraint.of) {

        // Extract the node by the name if it already exists
        if(constraint.of.name) {
          node = graph.spec.nodes.filter(function(node) { 
            return node.temp_name == constraint.of.name; 
          })[0];
        }

        var direction;
        if(constraint.position === "left" || constraint.position === "right") {
          direction = "x";
        } else {
          direction = "y";
        }

        if(node && node.boundary && node.boundary != direction) {
          node.boundary = "xy";
        }

        // Create a new node if need be.
        if(node == null) {
          node = {
            "x": constraint.of.x || 0,
            "y": constraint.of.y || 0,
            "temp": true,
            "fixed": true,
            "boundary": direction
          };
          if(constraint.of.name) node.temp_name = constraint.of.name;
          graph.spec.nodes.push(node);
          node._id = graph.spec.nodes.indexOf(node);
        }

      } else {
        console.error("Unknown \"of\" on position constraint: '" + constraint.of + "'");
      }
  }
  if(node == null) return []; // There is no node with which to compute the constraint.

  // Create the position constraints relative to the temp node
  var gap = constraint.gap || renderer.options["constgap"];
  for(var i=0; i<nodes.length; i++) {
    switch(constraint.position) {
      case "left":
        results.push(createColaPosition(nodes[i], node, "x", cid, gap));
        break;
      case "right":
        results.push(createColaPosition(node, nodes[i], "x", cid, gap));
        break;
      case "above":
        results.push(createColaPosition(nodes[i], node, "y", cid, gap));
        break;
      case "below":
        results.push(createColaPosition(node, nodes[i], "y", cid, gap));
        break;
      default:
        console.error("Unknown constraint.position: '" + constraint.position + "'");
    };
  };

  return results;
};

function circleConstraint(nodes, constraint, cid) {

  // Constants for computing edge length
  var gap = constraint.gap || renderer.options["constgap"];
  var angle = 360/nodes.length;
  var edge = Math.sqrt(2*(gap**2) - 2*(gap**2)*Math.cos(angle/180*Math.PI));

  // Label links that have at least one node in the circle layout
  graph.spec.links.forEach(function(link) {
    var source = graph.spec.nodes[link.source];
    var target = graph.spec.nodes[link.target];
    if(nodes.indexOf(source) != -1 || nodes.indexOf(target) != -1) {
      link.circle = true;
    }
  });

  // Create links for every node in the circle
  var links = [];
  if(constraint.sort) {
    nodes = nodes.sort(function(a,b) { return a[constraint.sort] - b[constraint.sort]; });
  }
  for (var i = 0; i < nodes.length; i++) {
    var index = i==0 ? nodes.length - 1 : i-1;
    var node = graph.spec.nodes.indexOf(nodes[index]);
    var next = graph.spec.nodes.indexOf(nodes[i]);
    links.push({"source": node, "target": next, "_temp": true, "length": edge});
  };

  var node;
  if(constraint.around) {
    // Extract the node by the name/id if it already exists
    if(constraint.around.name) {
      node = graph.spec.nodes.filter(function(node) { 
        return node.name == constraint.around.name; 
      })[0];
    } else if (constraint.around._id) {
      node = graph.spec.nodes.filter(function(node) { 
        return node._id == constraint.around._id; 
      })[0];
    } 

    // Create a node if one is not found
    if(node == null) {
      node = {
        "x": constraint.around.x || 200,
        "y": constraint.around.y || 200,
        "temp": true
      };
      if(constraint.around.name) node.name = constraint.around.name;
      graph.spec.nodes.push(node);
      node._id = graph.spec.nodes.indexOf(node);
    }

    // Create a new link from the center to all nodes in the circle
    nodes.forEach(function(n) {
      links.push({"source": node._id, "target": n._id, "_temp": true, "length": gap});
    });
  }

  graph.spec.links = graph.spec.links.concat(links);

};

function circleConstraint2(nodes, constraint, cid) {

  var linear = d3.scaleLinear()
      .domain(nodes.map(function(node) { return node.x; }))
      .range([0,360])
  var point = d3.pointRadial();

};

function groupConstraint(nodes, constraint, cid) {

  var ids = nodes.map(function(node) { return node._id; });
  var group = {"leaves": ids};
  layout.groups.push(group);

};

/********************* Determine Node Sets *********************/

function generateOrderFuncSort(def) {
  var order;
  if(def.order) {
    if(def.reverse) def.order.reverse();
    order = function(n1,n2) {
      return def.order.indexOf(n1[def.by]) - def.order.indexOf(n2[def.by]);
    };
  } else if(def.reverse) {
    order = function(n1,n2) {
      return n2[def.by] - n1[def.by];
    };
  } else {
    order = function(n1,n2) {
      return n1[def.by] - n2[def.by];
    };
  }
  return order;
};

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
  
  } else if(!def.partition && !def.relation) { 

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

  } else if(def.partition) {

    // Create a function to partition nodes based on "def.partition".
    inSet = function(node) {
      var value = node[def.partition];
      if(value != null && typeof value == "object") value = value._id;
      return value;
    };

  } else if(def.relation) {

    // Create a function to partition nodes based on "def.relation".
    // TODO: this is a little weird --> this is not working
    inSet = function(node) {
      var value = node[def.relation];
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
  if(renderer.options["debugprint"]) console.log("      Sets are: ", sets);
  var pairs = {};
  for(var i=0; i<sets.length; i++) {
    for(var j=i+1; j<sets.length; j++) {
        
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
function generateSets(nodes, inSet, constraint) {
  if(renderer.options["debugprint"]) console.log("      Computing sets...");

  var ignore, include, group;
  if(constraint && constraint.ignore) ignore = constraint.ignore;
  if(constraint && constraint.include) include = constraint.include;

  var sets = {};
  nodes.forEach(function(node) {
    var set = inSet(node);
    if(set == -1 || (ignore && ignore.indexOf(set) != -1)) return;
    var current = sets[set] || [];
    current.push(node);

    if(include && node[include]) {
      current.push(node[include]);
    }

    sets[set] = current;
  });
  
  if(renderer.options["setnode"]) {
    // TODO! We want to add the set nodes to the sets. 
    // We don"t want set nodes in the sets, we want them in the groups?
    // createSetNode(sets);
  }

  if(constraint instanceof Array) {
    constraint.forEach(function(test) {
      if(test.group) {
        var id = test.name || test.expr;
        var set = sets[id];

        if(renderer.options["setnode"]) {
          var node = createSetNode(set);
          set = set.concat([node]);
        }

        groupConstraint(set);
      }
    });
  } else if(constraint && constraint.group) {
    Object.keys(sets).forEach(function(setName) {
      var set = sets[setName];

      if(renderer.options["setnode"]) {
        var node = createSetNode(set);
        set = set.concat([node]);
      }

      groupConstraint(set);
    });
  } else if(renderer.options["setnode"]) {
    createSetNodes(sets);
  }

  return sets;
};

function createSetNodes(sets) {
  console.log("sets are", sets)
  Object.keys(sets).forEach(function(setName) {
    createSetNode(sets[setName]);
  });
};

function createSetNode(set) {
  var node = {
    "temp": true,
    "temp_type": "setNode"
  };
  graph.spec.nodes = graph.spec.nodes.concat([node]);
  node._id = graph.spec.nodes.indexOf(node);

  //sets[setName] = sets[setName].concat([node]);

  set.forEach(function(n) {
    if(n.temp) return;
    var link = {"source": n._id, "target": node._id, "temp": true};
    graph.spec.links = graph.spec.links.concat([link]);
  });
  return node;
};

function value(expr, node) {
  var result = node;
  if(expr.indexOf("datum") != -1) {
    expr = expr.replace(/ /g, "");
    var props = expr.split(".");
    for (var i = 1; i < props.length; i++) {
      result = result[props[i]];
    };
  } else if(expr.indexOf("\"") != -1) {
    
    var split = expr.split(/(")/g);
    var index = 0;
    while(split[index] != "\"") {
      index += 1;
    }
    result = split[index+1];

  } else if(expr.indexOf("\"") != -1) {

    var split = expr.split(/(\"")/g);
    var index = 0;
    while(split[index] != "\"") {
      index += 1;
    }
    result = split[index+1];

  } else {
    expr = expr.replace(/ /g, "");

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
    if(comp.length != 3) console.error("Invalid expr: \"" + expr + "\"");
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
function createColaPosition(left, right, axis, cid, gap) {
  if(!gap) gap = renderer.options["constgap"];
  var constraint = {
    "axis": axis,
    "left": graph.spec.nodes.indexOf(left),
    "right": graph.spec.nodes.indexOf(right),
    "gap": gap,
    "_type": cid
  };
  return constraint;
};

// TODO: is the separation constraint different from the position?
function createColaSeparation(left, right, axis, cid, gap) {
  if(!gap) gap = renderer.options["constgap"];
  var constraint = { 
    "type": "separation", 
    "axis": axis, 
    "left": graph.spec.nodes.indexOf(left),
    "right": graph.spec.nodes.indexOf(right),
    "gap": gap,
    "_type": cid
  };
  return constraint;
}
