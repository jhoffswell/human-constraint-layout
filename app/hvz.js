var hvz = {};

/***************************************************************/
/*********************** HVZ ENVIRONMENT ***********************/
/***************************************************************/

hvz.init = function(el) {

  el = d3.select(el);
  d3.text("app/template.html", function(err, text) { 

    el.html(text); 

    // Start up the inspector and renderer
    inspector.init();
    renderer.init();

    // Set up interactions in environment
    d3.select("#submit").on("click", hvz.start);
    d3.select(".separator").on("click", hvz.visibility);
    d3.select(".fa.fa-play").on("click", hvz.restart);
    d3.select(".fa.fa-exclamation-circle").on("click", inspector.showError);
    d3.select(".fa.fa-gear").on("click", inspector.showConfig);
    d3.select(".fa.fa-bug").on("click", inspector.showDebug);
    d3.select(".fa.fa-question-circle").on("click", inspector.showHelp);

    var exampleSel = d3.select('.sel_examples');
    exampleSel.on("change", hvz.load);
    exampleSel.append("option").text("Custom");
    exampleSel.selectAll("optgroup")
        .data(Object.keys(EXAMPLES))
      .enter().append("optgroup")
        .attr("label", function(key) { return key; })
      .selectAll("option.spec")
        .data(function(key) { return EXAMPLES[key]; })
      .enter().append("option")
        .text(function(d) { return d.name; });

    // Load the graph
    hvz.load();

  });
};

hvz.start = function() {
  if(renderer.options["debugprint"]) console.log("Starting layout...");

  // Load the graph from the editor.
  try {
    hvz.error = null;
    if(inspector.errorVisible) inspector.showError();
    var spec = JSON.parse(document.getElementsByClassName("spec")[0].value);
    graph.init(spec);
  } catch (error) {
    hvz.error = error;
    inspector.showError();
    console.error(error);
    return;
  }

  // Figure out the constraints for the graph layout.
  if(hvz.isUserConstraintGraph()) {
    try {
      graph.user_constraints = graph.spec.constraints;
      graph.spec.constraints = layout.getConstraints();
    } catch(error) {
      inspector.showError(error);
      console.error(error);
    }
  }
  document.getElementsByClassName("cola-spec")[0].value = prettyJSON();

  // Draw the graph
  renderer.draw();

  if(inspector.debugVisible) {
    inspector.debugVisible = false;
    inspector.showDebug();
  }
};

hvz.restart = function() {
  graph.draw();
};

hvz.load = function() {
  var exampleSel = document.getElementsByClassName("sel_examples")[0];
  var example = exampleSel.options[exampleSel.selectedIndex].value;
  var type = exampleSel.options[exampleSel.selectedIndex].parentNode.label;
  var PATH = "app/specs/" + (type ?  type + "-examples/" : "") + example + ".json";

  d3.text(PATH, function(spec) {
    graph.spec = spec;
    document.getElementsByClassName("spec")[0].value = graph.spec;
  });
};

hvz.visibility = function() {
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

hvz.isUserConstraintGraph = function() {
  return graph.spec.constraints && graph.spec.constraints[0].name != undefined;
};

function prettyJSON() {
  var spec = JSON.stringify(graph.spec)
      .replace("\"nodes\":[", "\n\t\"nodes\":[\n")
      .replace("\"links\":[", "\n\t\"links\":[\n")
      .replace("\"constraints\":[", "\n\t\"constraints\":[\n")
      .replace(/\],/g, "\n\t],")
      .replace(/\{\"/g, "\t\t{\"")
      .replace(/\},/g, "},\n")
      .replace(/\]\}/g, "\n\t]\n}");
  return spec;
};

function updateRange(type) {
  var value = document.getElementById("range-" + type).value;
  renderer.options[type] = value;
  d3.select("#value-" + type).html(value);
};

function updateCheck(type) {
  renderer.options[type] = document.getElementById("check-" + type).checked;
};

function updateText(type) {
  renderer.options[type] = document.getElementById("text-" + type).value;
};