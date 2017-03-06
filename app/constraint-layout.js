var layout = {};
var GAP = 50;
var WIDTH = 20;
var PAD = 1;

/********************** Environment Setup **********************/

layout.init = function() {

  // Set up interactions in environment
  d3.select("#submit").on("click", layout.start);
  d3.select(".separator").on("click", layout.visibility);
  d3.select(".fa.fa-play").on("click", layout.restart);
  d3.select(".fa.fa-exclamation-circle").on("click", showError);
  d3.select(".fa.fa-gear").on("click", showConfig);
  d3.select(".fa.fa-bug").on("click", showDebug);
  d3.select(".fa.fa-question-circle").on("click", showHelp);

  var exampleSel = d3.select('.sel_examples');
  exampleSel.on("change", layout.load);
  exampleSel.append("option").text("Custom");
  exampleSel.selectAll("optgroup")
      .data(Object.keys(EXAMPLES))
    .enter().append("optgroup")
      .attr("label", function(key) { return key; })
    .selectAll("option.spec")
      .data(function(key) { return EXAMPLES[key]; })
    .enter().append("option")
      .text(function(d) { return d.name; });

  layout.errorVisible = false;
  layout.configVisible = false;
  layout.debugVisible = false;
  layout.helpVisible = false;
  setOptions();

  layout.hidden_constraints = [];

  // Load the graph
  layout.load();
};

layout.start = function() {
  if(layout.options["debugprint"]) console.log("Starting layout...");

  // Load the graph from the editor.
  try {
    layout.error = null;
    if(layout.errorVisible) showError();
    layout.graph = JSON.parse(document.getElementsByClassName("spec")[0].value);
  } catch (error) {
    layout.error = error;
    showError();
    console.error(error);
    return;
  }
 
  // Set graph options
  var node = layout.graph.nodes[0];
  var type = node[layout.options["fillprop"]];
  layout.color = (typeof type == "string") ? d3.scaleOrdinal(d3.schemeDark2) : d3.scaleSequential(d3.interpolateYlGnBu);

  // Figure out the constraints for the graph layout.
  if(layout.isUserConstraintGraph()) {
    try {
      layout.user_constraints = layout.graph.constraints;
      layout.graph.constraints = getConstraints();
    } catch(error) {
      showError(error);
      console.error(error);
    }
  }
  document.getElementsByClassName("cola-spec")[0].value = prettyJSON();

  // Draw the graph
  layout.draw();

  if(layout.debugVisible) {
    layout.debugVisible = false;
    showDebug();
  }
};

layout.restart = function() {
  layout.draw();
};

layout.load = function() {
  var exampleSel = document.getElementsByClassName("sel_examples")[0];
  var example = exampleSel.options[exampleSel.selectedIndex].value;
  var type = exampleSel.options[exampleSel.selectedIndex].parentNode.label;
  var PATH = "/specs/" + (type ?  type + "-examples/" : "") + example + ".json";

  layout.mode = type;

  d3.text(PATH, function(graph) {
    layout.graph = graph;
    document.getElementsByClassName("spec")[0].value = layout.graph;
  });
};

layout.visibility = function() {
  var current = d3.select(this).attr("class");
  if(current.indexOf("down") !== -1) {
    d3.select(this)
        .attr("class", current.replace("down", "up"))
      .select("span")
        .attr("class", "fa fa-angle-double-up");
    d3.select(".cola-spec").style("display", "none");
  } else {
    d3.select(this)
        .attr("class", current.replace("up", "down"))
      .select("span")
        .attr("class", "fa fa-angle-double-down");
    d3.select(".cola-spec").style("display", "flex");
  }
};

layout.isUserConstraintGraph = function() {
  return layout.graph.constraints && layout.graph.constraints[0].name != undefined;
};

function prettyJSON() {
  var graph = JSON.stringify(layout.graph)
      .replace("\"nodes\":[", "\n\t\"nodes\":[\n")
      .replace("\"links\":[", "\n\t\"links\":[\n")
      .replace("\"constraints\":[", "\n\t\"constraints\":[\n")
      .replace(/\],/g, "\n\t],")
      .replace(/\{\"/g, "\t\t{\"")
      .replace(/\},/g, "},\n")
      .replace(/\]\}/g, "\n\t]\n}");
  return graph;
};

function setOptions() {
  layout.options = {};
  document.getElementById("range-noconst").value =  25;
  document.getElementById("range-userconst").value = 50;
  document.getElementById("range-layoutconst").value = 25;
  document.getElementById("range-linkdist").value = 60;
  document.getElementById("range-symmetric").value = 0;

  document.getElementById("text-fillprop").value = "_id";

  ["noconst", "userconst", "layoutconst", "linkdist", "symmetric"].map(updateRange);
  ["debugprint", "overlaps"].map(updateCheck);
  ["fillprop"].map(updateText);
};

function updateRange(type) {
  var value = document.getElementById("range-" + type).value;
  layout.options[type] = value;
  d3.select("#value-" + type).html(value);
};

function updateCheck(type) {
  layout.options[type] = document.getElementById("check-" + type).checked;
};

function updateText(type) {
  layout.options[type] = document.getElementById("text-" + type).value;
};

/********************* Graph Modifications *********************/

// Convert links using the "name" property of nodes as the "source"
// and "target" to the index notation.
function convertLinks() {
  var links = JSON.stringify(graph.links);
  for(var i=0; i<graph.nodes.length; i++) {
    links.replace(graph.nodes[i].name + ",", i + ",");
  }
  graph.links = JSON.parse(links);
  return graph;
};

function calculateDepths() {
  layout.graph.nodes.forEach(function(node) {
    node.depth = node.depth || getDepth(node);
  });
};

function calculateParents() {
  layout.graph.nodes.forEach(function(node) {
    node.parent = node.parent || getParent(node);
  });
};

function computeBuiltInProperties(constraint) {
  if(JSON.stringify(constraint).indexOf("depth") != -1) calculateDepths();
  if(JSON.stringify(constraint).indexOf("parent") != -1) calculateParents();
};

/******************** Constraint Generation ********************/

// Convert the user defined constraints into cola constraints
function getConstraints() {
  if(layout.options["debugprint"]) console.log("  Computing cola constraints...");

  layout.sets = {};
  
  // Add an _id to the nodes
  layout.index = -1;
  layout.graph.nodes.map(setID);
  computeBuiltInProperties(layout.graph.constraints);

  // Process the constraints
  var constraints = [].concat.apply([], layout.graph.constraints.map(processConstraint));
  return constraints;
};

// Process each user defined constraint.
function processConstraint(constraint) {
  if(layout.options["debugprint"]) console.log("    Processing constraint '" + constraint.name + "'...");

  if(constraint.from && !constraint.set) {

    // Handle "between" (aka "from") constraints
    var sets = Object.keys(layout.sets[constraint.from]).map(function(key) { 
      return layout.sets[constraint.from][key]; 
    });
    layout.sets[constraint.name] = generatePairs(sets);

  } else if(!constraint.from && constraint.set) {

    // Handle "within" (aka "set") constraints
    layout.sets[constraint.name] = generateSets(layout.graph.nodes, generateInSetFunc(constraint.set));

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
  if(layout.options["debugprint"]) console.log("      Adding cola constraints...");
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
  // layout.graph.nodes.push(node);
  // node._id = layout.graph.nodes.indexOf(node);

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
    inSet = function(node) { return true; };
  // } else if(def.type == "==") {
  //   // TODO: this is never used right now...
  //   inSet = function(node) {
  //     return node[def.property] == def.value;
  //   };
  } else if(def.property) {
    inSet = function(node) {
      var value = node[def.property];
      if(value != null && typeof value == "object") value = value._id;
      return value;
    };
  } else if(def.expr) { 
    inSet = function(node) {
      return evaluate(def.expr, node) ? true : -1;
    };
  } else {
    console.error("Unknown set definition: " + def);
  }

  return inSet;
};

function generatePairs(sets) {
  if(layout.options["debugprint"]) console.log("      Computing pairs...");
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
  if(layout.options["debugprint"]) console.log("      Computing sets...");

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
    "left": layout.graph.nodes.indexOf(left),
    "right": layout.graph.nodes.indexOf(right),
    "gap": GAP,
    "_type": cid
  };
  return constraint;
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

    result = evaluate(andor[0]);
    for (var i = 1; i < andor.length; i=i+2) {
      switch(andor[i]) {
        case "&&":
          result = result && evaluate(andor[i+1]);
          break;
        case "||":
          result = result || evaluate(andor[i+1]);
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

/*********************** Node Properties ***********************/

function setSize(node) {
  node.width = node.width || WIDTH;
  node.height = node.height || WIDTH;
};

function setID(node) {
  node._id = node._id || layout.graph.nodes.indexOf(node);
};

function getLabel(node) {
  return node[layout.options["labelprop"]] || node.name || node._id;
};

function setColor(node) {
  var value = node[layout.options["fillprop"]] || 0.5;
  if(typeof value == "number") {
    var max = Math.max(...layout.graph.nodes.map(function(n) { return n[layout.options["fillprop"]] || 0.5; }));
    node.color = node.color || layout.color(value / max);
  } else {
    node.color = node.color || layout.color(value);
  }
};

function getColor(node) {
  var value = node[layout.options["fillprop"]] || 0.5;
  return node.color || layout.color(value);
};

// TODO: This will not work on cyclic graphs!!
function getDepth(node) {
  var index = node._id;
  var incoming = layout.graph.links.filter(function(link) { return link.target == index; });
  var depth = 0;
  if(incoming.length > 0) {
    var parentDepths = incoming.map(function(link) { 
      var parent = layout.graph.nodes[link.source];
      return parent.depth || getDepth(parent);
    });
    depth = Math.max(parentDepths) + 1;
  }
  return depth;
};

// TODO: This will be an issue if a node has more than one parent.
function getParent(node) {
  var parent = null;
  var index = node._id;
  var incoming = layout.graph.links.filter(function(link) { return link.target == index; });
  if(incoming.length == 1) {
    parent = layout.graph.nodes[incoming[0].source];
  } else if(incoming.length > 1) {
    parent = layout.graph.nodes[incoming[0].source];
    console.error("getParent(node): " + node + " has more than one parent.");
  }
  return parent;
};

/************************ Graph Drawing ************************/

layout.draw = function() {
  if(layout.options["debugprint"]) console.log("  Drawing the graph...");
  if(true) layout.graph.nodes.forEach(setColor);

  // Clear the old graph
  d3.select(".graph").selectAll("*").remove();

  // Setup Cola
  var width = d3.select("svg").style("width").replace("px", ""),
      height = d3.select("svg").style("height").replace("px", "");
  layout.colajs = cola.d3adaptor().size([width, height]);

  // Update the graph nodes with style properties
  layout.graph.nodes.map(setSize);

  // Add the graph to the layout
  if(layout.graph.nodes) layout.colajs.nodes(layout.graph.nodes);
  if(layout.graph.links) layout.colajs.links(layout.graph.links);
  if(layout.graph.groups) layout.colajs.groups(layout.graph.groups);
  if(layout.graph.constraints) layout.colajs.constraints(layout.graph.constraints);

  // Start the cola.js layout
  layout.colajs
      .linkDistance(layout.options["linkdist"])
      .avoidOverlaps(layout.options["overlaps"]);
  if(layout.options["symmetric"] != 0) layout.colajs.symmetricDiffLinkLengths(layout.options["symmetric"]);
  layout.colajs.start(layout.options["noconst"],layout.options["userconst"],layout.options["layoutconst"]);

  layout.colajs.on("tick", layout.tick);

  // Set up zoom behavior on the graph svg.
  var zoom = d3.behavior.zoom()
      .scaleExtent([0.25, 2])
    .on("zoom", zoomed);

  var svg = d3.select(".graph")
    .append("g").attr("transform", "translate(0,0)")
    .call(zoom);

  // Draw an invisible background to capture zoom events
  var rect = d3.select(".graph").select("g").append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "white");

  // Draw the graph
  layout.svg = svg.append("g");
  layout.drawLinks();
  if(layout.graph.groups) layout.drawGroups();
  layout.drawNodes();
};

layout.drawLinks = function() {
  layout.link = layout.svg.selectAll(".link")
      .data(layout.graph.links)
    .enter().append("line")
      .attr("class", "link")
      .style("stroke-width", 1)
      .style("stroke", "#ddd");
};

layout.drawCircleNodes = function() {
  layout.node = layout.svg.selectAll(".node")
        .data(layout.graph.nodes)
      .enter().append("circle")
        .attr("class", "node")
        .attr("r", WIDTH / 2)
        .style("fill", getColor)
      .call(layout.colajs.drag);

  layout.node.append("title").text(getLabel);
};

layout.drawNodes = function() {
  layout.node = layout.svg.selectAll(".node")
        .data(layout.graph.nodes)
      .enter().append("rect")
        .attr("class", "node")
        .attr("width", function(d) { return d.width; })
        .attr("height", function(d) { return d.height; })
        .attr("rx", WIDTH)
        .attr("ry", WIDTH)
        .style("fill", getColor)
      .call(layout.colajs.drag);

  // Prevent interaction with nodes from causing pan on background.
  layout.node
    .on("mousedown", function() { d3.event.stopPropagation(); })
    .on("mousemove", function() { d3.event.stopPropagation(); });

  layout.node.append("title").text(getLabel);
};

layout.drawGroups = function() {
  layout.group = layout.svg.selectAll(".group")
        .data(layout.graph.groups)
      .enter().append("rect")
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("class", "group")
        .style("fill", getColor)
      .call(layout.colajs.drag);
};

layout.tick = function() {
  layout.link
    .attr("x1", function (d) { return d.source.x; })
    .attr("y1", function (d) { return d.source.y; })
    .attr("x2", function (d) { return d.target.x; })
    .attr("y2", function (d) { return d.target.y; });

  layout.node
      .attr("x", function (d) { return d.x - d.width / 2 + PAD; })
      .attr("y", function (d) { return d.y - d.height / 2 + PAD; });

  if(!layout.group) return;
  layout.group
      .attr("x", function (d) { return d.bounds.x; })
      .attr("y", function (d) { return d.bounds.y; })
      .attr("width", function (d) { return d.bounds.width(); })
      .attr("height", function (d) { return d.bounds.height(); });
};

function zoomed() {
  layout.svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
};

function highlight(nodes) {
  var ids = nodes.map(function(n) { return n._id; });
  d3.selectAll(".node")
      .filter(function(rect) { return ids.indexOf(rect._id) != -1; })
      .style("stroke", "red")
      .style("stroke-width", 3);
};

/*********************** Show Temp Region **********************/

function clearTemp(mode) {
  // Clear the config state
  if(mode != "error") {
    layout.errorVisible = false;
    d3.select(".fa.fa-exclamation-circle").style("color", "white");
  }
  if(mode != "config") {
    layout.configVisible = false;
    d3.select(".fa.fa-gear").style("color", "white");
  }
  if(mode != "debug") {
    layout.debugVisible = false;
    d3.select(".fa.fa-bug").style("color", "white");
  }
  if(mode != "help") {
    layout.helpVisible = false;
    d3.select(".fa.fa-question-circle").style("color", "white");
  }
};

function showError() {
  clearTemp("error");

  layout.errorVisible = layout.error ? true : !layout.errorVisible;
  if(layout.errorVisible) {
    d3.select(".fa.fa-exclamation-circle").style("color", "#c80101");
    var div = d3.select(".temp-region")
        .attr("class", "temp-region error")
        .style("display", "flex");
    div.select(".error p").text(layout.error);
  } else {
    d3.select(".fa.fa-exclamation-circle").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};

function showConfig() {
  clearTemp("config");

  layout.configVisible = !layout.configVisible;
  if(layout.configVisible) {
    d3.select(".fa.fa-gear").style("color", "#01adc8");
    var div = d3.select(".temp-region")
        .attr("class", "temp-region config")
        .style("display", "flex");
  } else {
    d3.select(".fa.fa-gear").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};

function showDebug() {
  clearTemp("debug");

  layout.debugVisible = !layout.debugVisible;
  if(layout.debugVisible) {
    d3.select(".fa.fa-bug").style("color", "#efad0c");
    d3.select(".temp-region")
        .attr("class", "temp-region debug")
        .style("display", "flex");

    if(typeof layout.graph == "string") return;
    d3.selectAll(".temp-region .debug .const").remove();
    createDebugContents();
  } else {
    d3.select(".fa.fa-bug").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};

function createDebugContents() {
  var constraints = Object.keys(layout.sets) || [];
  var div = d3.select(".temp-region .debug");
  var group = div.selectAll(".const")
      .data(constraints)
    .enter().append("div")
      .attr("class", "const")
      .style("width", document.getElementsByClassName("graph")[0].clientWidth);

  // ----------------------------------------------
  // Draw a header for each user defined constraint
  // ----------------------------------------------

  group.append("span").text("User Constraint: ")
      .style("font-size", "18px");
  group.append("span")
      .text(function(d) { return d; })
      .attr("class", "name");
  group.append("span")
      .attr("class", "fa fa-caret-down")
    .on("click", changeConstraintVisibility);

  // ----------------------------------------------
  // Show information about the created sets
  // ----------------------------------------------

  var contents = group.append("div")
      .attr("class", "contents")
      .attr("id", function(d) { return d + "_contents"; });

  var header = contents.append("div");
  header.append("span").html(getNumSetsString);

  header.append("span")
      .attr("class", "fa fa-caret-right")
    .on("click", changeSetVisibility);

  // ----------------------------------------------
  // Add a label for each created set
  // ----------------------------------------------

  var select = contents.append("div")
      .attr("class", "selects")
      .attr("id", function(d) { return d + "_sets"; })
      .style("display", "none");

  var g = select.selectAll("check")
      .data(function(d) { return Object.keys(layout.sets[d]); })
    .enter().append("g")
      .attr("class", "check")
      .style("display", "inline-block");

  g.append("span")
      .text(function(d) { return d; })
      .style("margin", "0px 3px")
    .on("mouseover", function(setName) {
      var constraintName = d3.select(this.parentNode.parentNode).datum();
      highlight(layout.sets[constraintName][setName]);
    })
    .on("mouseout", function() {
      d3.selectAll(".node").style("stroke-width", 0);
    });

  // ----------------------------------------------
  // Show information about the sub constraints
  // ----------------------------------------------

  header = contents.append("div");
  header.append("span").html(getSubConstraintsString);
  header.append("span")
      .attr("class", function(d) {
        var constraints = layout.user_constraints.filter(function(c) { return c.name == d; })[0].constraints;
        if(!constraints) return "";
        return "fa fa-caret-down";
      })
    .on("click", changeSubConstraintVisibility);

  // ----------------------------------------------
  // Add information and selection for each const.
  // ----------------------------------------------

  var select = contents.append("div")
      .attr("class", "selects")
      .attr("id", function(d) { return d + "_constraints"; });

  var g = select.selectAll("check")
      .data(getSubConstraints)
    .enter().append("g")
      .attr("class", "check")
      .style("display", "block");

  g.append("input").attr("type", "checkbox")
      .html(function(d) { return d; })
      .attr("checked", "true")
    .on("change", changeAppliedConstraints);

  g.append("span").text(function(d) { return d + ": "; });
  g.append("span").html(getSubConstraintsCountString).style("font-style", "italic");
};

function showHelp() {
  clearTemp("help");

  layout.helpVisible = !layout.helpVisible;
  if(layout.helpVisible) {
    d3.select(".fa.fa-question-circle").style("color", "#78c801");
    var div = d3.select(".temp-region")
        .attr("class", "temp-region help")
        .style("display", "flex");
  } else {
    d3.select(".fa.fa-question-circle").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};

/********************** Get Debug Contents  ********************/

function getNumSetsString(d) {
  var number = Object.keys(layout.sets[d]).length;
  number = "<span class='number'>" + number + "</span>";
  return "Created " + number + " sets of nodes";
};

function getSubConstraints(d) {
  var constraints = layout.user_constraints.filter(function(c) { return c.name == d; })[0].constraints;
  if(!constraints) return [];
  return constraints.map(function(c) { return c.type; }); 
};

function getSubConstraintsString(d) {
  var constraints = layout.user_constraints.filter(function(c) { return c.name == d; })[0].constraints;
  if(!constraints) constraints = [];

  var number = "<span class='number'>" + constraints.length + "</span>";  
  var are = constraints.length == 1 ? " is " : " are ";
  var s = constraints.length == 1 ? " constraint " : " constraints ";

  return "There" + are + number + s + "defined over these sets";
};

function getSubConstraintsCountString(typeName) {
  var constraintName = d3.select(this.parentNode.parentNode).datum();
  var constraints = layout.graph.constraints.filter(function(c) { 
    return c._type ==  constraintName + "_" + typeName; 
  });
  number = "<span class='number'>" + constraints.length + "</span>";
    
  var s = constraints.length == 1 ? " constraint " : " constraints ";

  return "This constraint creates " + number + " cola.js" + s;
};

/******************* Temp Region Interactions ******************/

function changeConstraintVisibility(d) {
  var className = d3.select(this).attr("class");
  if(className == "fa fa-caret-right") {
    d3.select(this).attr("class", "fa fa-caret-down");
    d3.select("#" + d + "_contents").style("display", "inherit");
  } else {
    d3.select(this).attr("class", "fa fa-caret-right");
    d3.select("#" + d + "_contents").style("display", "none");
  }
};

function changeSetVisibility(d) {
  var className = d3.select(this).attr("class");
  if(className == "fa fa-caret-right") {
    d3.select(this).attr("class", "fa fa-caret-down");
    d3.select("#" + d + "_sets").style("display", "inherit");
  } else {
    d3.select(this).attr("class", "fa fa-caret-right");
    d3.select("#" + d + "_sets").style("display", "none");
  }
};

function changeSubConstraintVisibility(d) {
  if(d3.select(this).attr("class") == "") return;

  var className = d3.select(this).attr("class");
  if(className == "fa fa-caret-right") {
    d3.select(this).attr("class", "fa fa-caret-down");
    d3.select("#" + d + "_constraints").style("display", "inherit");
  } else {
    d3.select(this).attr("class", "fa fa-caret-right");
    d3.select("#" + d + "_constraints").style("display", "none");
  }
};

function changeAppliedConstraints(typeName) {
  var constraintName = d3.select(this.parentNode.parentNode).datum();
  if(d3.select(this)[0][0].checked) {
    var include = layout.hidden_constraints.filter(function(c) {
      return c._type == constraintName + "_" + typeName;
    });
    layout.graph.constraints = layout.graph.constraints.concat(include);
  } else {
    var exclude = layout.graph.constraints.filter(function(c) {
      return c._type == constraintName + "_" + typeName;
    });
    layout.hidden_constraints = layout.hidden_constraints.concat(exclude);
    layout.graph.constraints = layout.graph.constraints.filter(function(c) {
      return c._type != constraintName + "_" + typeName;
    });
  }
  layout.restart();
};
