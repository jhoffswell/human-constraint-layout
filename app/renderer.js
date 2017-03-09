var renderer = {};

/***************************************************************/
/************************ GRAPH DRAWING ************************/
/***************************************************************/

renderer.init = function() {
  renderer.options = {};
  document.getElementById("range-noconst").value =  50;
  document.getElementById("range-userconst").value = 100;
  document.getElementById("range-layoutconst").value = 200;
  document.getElementById("range-linkdist").value = 60;
  document.getElementById("range-symmetric").value = 0;
  document.getElementById("range-constgap").value = 50;
  document.getElementById("range-nodesize").value = 20;

  document.getElementById("check-arrows").checked = true;

  document.getElementById("text-fillprop").value = "_id";

  ["noconst", "userconst", "layoutconst", "linkdist", "symmetric", "constgap", "nodesize"].map(updateRange);
  ["debugprint", "overlaps", "arrows"].map(updateCheck);
  ["fillprop"].map(updateText);
};

renderer.draw = function() {
  if(renderer.options["debugprint"]) console.log("  Drawing the graph...");
  graph.spec.nodes.forEach(graph.setColor);

  // Clear the old graph
  d3.select(".graph").selectAll("*").remove();

  // Setup Cola
  var width = d3.select("svg").style("width").replace("px", ""),
      height = d3.select("svg").style("height").replace("px", "");
  renderer.colajs = cola.d3adaptor(d3).size([width, height]);

  // Update the graph nodes with style properties
  graph.spec.nodes.map(graph.setSize);

  // Add the graph to the layout
  if(graph.spec.nodes) renderer.colajs.nodes(graph.spec.nodes);
  if(graph.spec.links) renderer.colajs.links(graph.spec.links);
  if(graph.spec.groups) renderer.colajs.groups(graph.spec.groups);
  if(graph.spec.constraints) renderer.colajs.constraints(graph.spec.constraints);

  // Start the cola.js layout
  renderer.colajs
      .linkDistance(function(d) {
        return d.length || renderer.options["linkdist"]
      })
      .avoidOverlaps(renderer.options["overlaps"])
      .convergenceThreshold(1e-3);
  if(renderer.options["symmetric"] != 0) renderer.colajs.symmetricDiffLinkLengths(renderer.options["symmetric"]);
  
  // Start the layout engine.
  renderer.colajs.start(renderer.options["noconst"],renderer.options["userconst"],renderer.options["layoutconst"]);
  renderer.colajs.on("tick", renderer.tick);

  // Set up zoom behavior on the graph svg.
  var zoom = d3.behavior.zoom().scaleExtent([0.25, 2]).on("zoom", zoomed);

  var svg = d3.select(".graph").append("g")
      .attr("transform", "translate(0,0)")
    .call(zoom);

  // Draw an invisible background to capture zoom events
  var rect = d3.select(".graph").select("g").append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "white");

  // Draw the graph
  renderer.svg = svg.append("g");
  renderer.drawLinks();
  if(graph.spec.groups) renderer.drawGroups();
  renderer.drawNodes();
};

renderer.drawLinks = function() {
  renderer.links = renderer.svg.selectAll(".link")
      .data(graph.spec.links)
    .enter().append("line")
      .attr("class", "link");

  if(renderer.options["arrows"]) {
    renderer.svg.append("defs").selectAll("marker")
        .data(["suit", "licensing", "resolved"])
      .enter().append("marker")
        .attr("id", function(d) { return d; })
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("path")
        .attr("d", "M0,-5L10,0L0,5 L10,0 L0, -5");
    renderer.links.style("marker-end",  "url(#suit)");
  }    
};

renderer.drawCircleNodes = function() {
  renderer.nodes = renderer.svg.selectAll(".node")
        .data(graph.spec.nodes)
      .enter().append("circle")
        .attr("class", "node")
        .attr("r", renderer.options["nodesize"] / 2)
        .style("fill", graph.getColor)
      .call(renderer.colajs.drag);

  renderer.nodes.append("title").text(graph.getLabel);
};

renderer.drawNodes = function() {
  renderer.nodes = renderer.svg.selectAll(".node")
        .data(graph.spec.nodes)
      .enter().append("rect")
        .attr("class", "node")
        .attr("width", function(d) { return d.width; })
        .attr("height", function(d) { return d.height; })
        .attr("rx", renderer.options["nodesize"])
        .attr("ry", renderer.options["nodesize"])
        .style("fill", graph.getColor)
      .call(renderer.colajs.drag);

  // Prevent interaction with nodes from causing pan on background.
  renderer.nodes
    .on("mousedown", function() { d3.event.stopPropagation(); })
    .on("mousemove", function() { d3.event.stopPropagation(); });

  renderer.nodes.append("title").text(graph.getLabel);
};

renderer.drawGroups = function() {
  renderer.groups = renderer.svg.selectAll(".group")
        .data(graph.spec.groups)
      .enter().append("rect")
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("class", "group")
        .style("fill", graph.getColor)
      .call(renderer.colajs.drag);
};

renderer.tick = function() {
  renderer.links
    .attr("x1", function (d) { return d.source.x; })
    .attr("y1", function (d) { return d.source.y; })
    .attr("x2", function (d) { return d.target.x; })
    .attr("y2", function (d) { return d.target.y; });

  renderer.nodes
      .attr("x", function (d) { return d.x - d.width / 2; })
      .attr("y", function (d) { return d.y - d.height / 2; });

  if(!renderer.groups) return;
  renderer.groups
      .attr("x", function (d) { return d.bounds.x; })
      .attr("y", function (d) { return d.bounds.y; })
      .attr("width", function (d) { return d.bounds.width(); })
      .attr("height", function (d) { return d.bounds.height(); });
};

function zoomed() {
  renderer.svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
};

renderer.highlight = function(nodes) {
  if(renderer.options["debugprint"]) console.log("  Highlighting: ", nodes);
  var ids = nodes.map(function(n) { return n._id; });
  d3.selectAll(".node")
      .filter(function(rect) { return ids.indexOf(rect._id) != -1; })
      .style("stroke", "red")
      .style("stroke-width", 3);
};