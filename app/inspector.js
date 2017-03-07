var inspector = {};

/***************************************************************/
/************************** INSPECTOR **************************/
/***************************************************************/

inspector.init = function() {
  inspector.errorVisible = false;
  inspector.configVisible = false;
  inspector.debugVisible = false;
  inspector.helpVisible = false;
};

function clearInspector(mode) {
  // Clear the config state
  if(mode != "error") {
    inspector.errorVisible = false;
    d3.select(".fa.fa-exclamation-circle").style("color", "white");
  }
  if(mode != "config") {
    inspector.configVisible = false;
    d3.select(".fa.fa-gear").style("color", "white");
  }
  if(mode != "debug") {
    inspector.debugVisible = false;
    d3.select(".fa.fa-bug").style("color", "white");
  }
  if(mode != "help") {
    inspector.helpVisible = false;
    d3.select(".fa.fa-question-circle").style("color", "white");
  }
};

/***************************************************************/
/************************** Error Pane *************************/
/***************************************************************/

inspector.showError = function() {
  clearInspector("error");

  inspector.errorVisible = hvz.error ? true : !inspector.errorVisible;
  if(inspector.errorVisible) {
    d3.select(".fa.fa-exclamation-circle").style("color", "#c80101");
    var div = d3.select(".temp-region")
        .attr("class", "temp-region error")
        .style("display", "flex");
    div.select(".error p").text(hvz.error);
  } else {
    d3.select(".fa.fa-exclamation-circle").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};

/***************************************************************/
/************************** Config Pane ************************/
/***************************************************************/

inspector.showConfig = function() {
  clearInspector("config");

  inspector.configVisible = !inspector.configVisible;
  if(inspector.configVisible) {
    d3.select(".fa.fa-gear").style("color", "#01adc8");
    var div = d3.select(".temp-region")
        .attr("class", "temp-region config")
        .style("display", "flex");
  } else {
    d3.select(".fa.fa-gear").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};

/******************** Update Config Options ********************/

function updateRange(type) {
  var value = document.getElementById("range-" + type).value;
  renderer.options[type] = Number(value);
  d3.select("#value-" + type).html(value);
  if(graph.spec && graph.spec.nodes) hvz.start();
};

function updateCheck(type) {
  renderer.options[type] = document.getElementById("check-" + type).checked;
  if(graph.spec && graph.spec.nodes) hvz.start();
};

function updateText(type) {
  renderer.options[type] = document.getElementById("text-" + type).value;
  if(graph.spec && graph.spec.nodes) hvz.start();
};

/***************************************************************/
/************************** Debug Pane *************************/
/***************************************************************/

inspector.showDebug = function() {
  clearInspector("debug");

  inspector.debugVisible = !inspector.debugVisible;
  if(inspector.debugVisible) {
    d3.select(".fa.fa-bug").style("color", "#efad0c");
    d3.select(".temp-region")
        .attr("class", "temp-region debug")
        .style("display", "flex");

    if(typeof graph.spec == "string") return;
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
      renderer.highlight(layout.sets[constraintName][setName]);
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
        var constraints = graph.user_constraints.filter(function(c) { return c.name == d; })[0].constraints;
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

/********************** Get Debug Contents  ********************/

function getNumSetsString(d) {
  var number = Object.keys(layout.sets[d]).length;
  number = "<span class='number'>" + number + "</span>";
  return "Created " + number + " sets of nodes";
};

function getSubConstraints(d) {
  var constraints = graph.user_constraints.filter(function(c) { return c.name == d; })[0].constraints;
  if(!constraints) return [];
  return constraints.map(function(c) { return c.type; }); 
};

function getSubConstraintsString(d) {
  var constraints = graph.user_constraints.filter(function(c) { return c.name == d; })[0].constraints;
  if(!constraints) constraints = [];

  var number = "<span class='number'>" + constraints.length + "</span>";  
  var are = constraints.length == 1 ? " is " : " are ";
  var s = constraints.length == 1 ? " constraint " : " constraints ";

  return "There" + are + number + s + "defined over these sets";
};

function getSubConstraintsCountString(typeName) {
  var constraintName = d3.select(this.parentNode.parentNode).datum();
  var constraints = graph.spec.constraints.filter(function(c) { 
    return c._type ==  constraintName + "_" + typeName; 
  });
  number = "<span class='number'>" + constraints.length + "</span>";
    
  var s = constraints.length == 1 ? " constraint " : " constraints ";

  return "This constraint creates " + number + " cola.js" + s;
};

/********************** Debug Interactions *********************/

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
    var include = graph.hidden_constraints.filter(function(c) {
      return c._type == constraintName + "_" + typeName;
    });
    graph.spec.constraints = graph.spec.constraints.concat(include);
  } else {
    var exclude = graph.spec.constraints.filter(function(c) {
      return c._type == constraintName + "_" + typeName;
    });
    graph.hidden_constraints = graph.hidden_constraints.concat(exclude);
    graph.spec.constraints = graph.spec.constraints.filter(function(c) {
      return c._type != constraintName + "_" + typeName;
    });
  }
  hvz.restart();
};

/***************************************************************/
/*************************** Help Pane *************************/
/***************************************************************/

inspector.showHelp = function() {
  clearInspector("help");

  inspector.helpVisible = !inspector.helpVisible;
  if(inspector.helpVisible) {
    d3.select(".fa.fa-question-circle").style("color", "#78c801");
    var div = d3.select(".temp-region")
        .attr("class", "temp-region help")
        .style("display", "flex");
  } else {
    d3.select(".fa.fa-question-circle").style("color", "white");
    d3.select(".temp-region").style("display", "none");
  }
};