var renderer = {};

/***************************************************************/
/************************ GRAPH DRAWING ************************/
/***************************************************************/

renderer.init = function() {
  renderer.options = {};
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

renderer.draw = function() {
  if(renderer.options["debugprint"]) console.log("  Drawing the graph...");
  graph.spec.nodes.forEach(graph.setColor);

  // Clear the old graph
  d3.select(".graph").selectAll("*").remove();

  // Setup Cola
  var width = d3.select("svg").style("width").replace("px", ""),
      height = d3.select("svg").style("height").replace("px", "");
  renderer.colajs = cola.d3adaptor().size([width, height]);

  // Update the graph nodes with style properties
  graph.spec.nodes.map(graph.setSize);

  // Add the graph to the layout
  if(graph.spec.nodes) renderer.colajs.nodes(graph.spec.nodes);
  if(graph.spec.links) renderer.colajs.links(graph.spec.links);
  if(graph.spec.groups) renderer.colajs.groups(graph.spec.groups);
  if(graph.spec.constraints) renderer.colajs.constraints(graph.spec.constraints);

  // Start the cola.js layout
  renderer.colajs
      .linkDistance(renderer.options["linkdist"])
      .avoidOverlaps(renderer.options["overlaps"]);
  if(renderer.options["symmetric"] != 0) renderer.colajs.symmetricDiffLinkLengths(renderer.options["symmetric"]);
  renderer.colajs.start(renderer.options["noconst"],renderer.options["userconst"],renderer.options["layoutconst"]);

  renderer.colajs.on("tick", renderer.tick);

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
  renderer.svg = svg.append("g");
  renderer.drawLinks();
  if(graph.spec.groups) renderer.drawGroups();
  renderer.drawNodes();
};

renderer.drawLinks = function() {
  renderer.links = renderer.svg.selectAll(".link")
      .data(graph.spec.links)
    .enter().append("line")
      .attr("class", "link")
      .style("stroke-width", 1)
      .style("stroke", "#ddd");
};

renderer.drawCircleNodes = function() {
  renderer.nodes = renderer.svg.selectAll(".node")
        .data(graph.spec.nodes)
      .enter().append("circle")
        .attr("class", "node")
        .attr("r", WIDTH / 2)
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
        .attr("rx", WIDTH)
        .attr("ry", WIDTH)
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
      .attr("x", function (d) { return d.x - d.width / 2 + PAD; })
      .attr("y", function (d) { return d.y - d.height / 2 + PAD; });

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
  var ids = nodes.map(function(n) { return n._id; });
  d3.selectAll(".node")
      .filter(function(rect) { return ids.indexOf(rect._id) != -1; })
      .style("stroke", "red")
      .style("stroke-width", 3);
};