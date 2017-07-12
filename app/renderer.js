var renderer = {};

/***************************************************************/
/************************ GRAPH DRAWING ************************/
/***************************************************************/

renderer.init = function() {
  renderer.options = {};
  document.getElementById("range-noconst").value =  50;
  document.getElementById("range-userconst").value = 100;
  document.getElementById("range-layoutconst").value = 200;
  document.getElementById("range-linkdist").value = 0;
  document.getElementById("range-jaccard").value = 0;
  document.getElementById("range-symmetric").value = 0;
  document.getElementById("range-constgap").value = 50;
  document.getElementById("range-nodesize").value = 20;
  document.getElementById("range-nodepad").value = 2;

  document.getElementById("check-layoutnode").checked = true;
  document.getElementById("check-setnode").checked = false;
  document.getElementById("check-arrows").checked = false;
  document.getElementById("check-curved").checked = false;

  document.getElementById("text-fillprop").value = "_id";

  ["noconst", "userconst", "layoutconst", "linkdist", "jaccard", "symmetric", "constgap", "nodesize", "nodepad"].map(updateRange);
  ["debugprint", "layoutnode", "setnode", "overlaps", "arrows", "curved"].map(updateCheck);
  ["fillprop"].map(updateText);
};

function Node() {
  var pad = renderer.options["nodepad"];
  var width = renderer.options["nodesize"] + 2*pad;
  var height = renderer.options["nodesize"] + 2*pad;
  return {"width": width, "height": height, "padding": pad};
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
  if(graph.spec.links) {
    var links = graph.spec.links.filter(function(link) { return !link.circle; });
    //var links = graph.spec.links.filter(function(link) { return link._temp; });
    //var links = graph.spec.links;
    renderer.colajs.links(links);
    
    // Apply the appropriate edge link to circle edges
    // if(links.length != graph.spec.links.length) {
    renderer.colajs.linkDistance(function(d) { 
      var edgeLength = d.length ? d.length : 100;
      return edgeLength; 
    });
    // }

    // For all the links that were filtered out prior to the layout, fix the node linking
    graph.spec.links.forEach(function(link) {
      if(typeof link.source === "number" || typeof link.target === "number") {
        link.source = graph.spec.nodes[link.source];
        link.target = graph.spec.nodes[link.target];
      }
    });
  }
  if(graph.spec.groups) renderer.colajs.groups(graph.spec.groups);
  if(graph.spec.constraints) renderer.colajs.constraints(graph.spec.constraints);

  // Start the cola.js layout
  renderer.colajs
      .avoidOverlaps(renderer.options["overlaps"])
      .convergenceThreshold(1e-3);
  if(renderer.options["linkdist"] != 0 ) {
    renderer.colajs.linkDistance(function(d) {
      if(d.temp) return 1;
      return renderer.options["linkdist"];
    });
  };
  if(renderer.options["jaccard"] != 0) renderer.colajs.jaccardLinkLengths(renderer.options["jaccard"]);
  if(renderer.options["symmetric"] != 0) renderer.colajs.symmetricDiffLinkLengths(renderer.options["symmetric"]);
  
  // Start the layout engine.
  renderer.colajs.start(renderer.options["noconst"],renderer.options["userconst"],renderer.options["layoutconst"]);
  renderer.colajs.on("tick", renderer.tick);

  // Set up zoom behavior on the graph svg.
  var zoom = d3.behavior.zoom().scaleExtent([0.25, 2]).on("zoom", zoomed);

  var svg = d3.select(".graph").append("g")
      .attr("transform", "translate(0,0)")
    .call(zoom)
    .on("click", renderer.opacity);

  // Draw an invisible background to capture zoom events
  var rect = d3.select(".graph").select("g").append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "white");

  // Draw the graph
  renderer.svg = svg.append("g");
  renderer.options["curved"] ? renderer.drawCurvedLinks() : renderer.drawLinks();
  if(graph.spec.groups) renderer.drawGroups();
  renderer.drawNodes();
};

renderer.drawLinks = function() {

  //var links = graph.spec.links.filter(function(link) { return !link._temp; });

  renderer.links = renderer.svg.selectAll(".link")
      .data(graph.spec.links)
    .enter().append("line")
      .attr("class", function(d) {
        var className = "link";
        if(d._temp) {
          className += (renderer.options["layoutnode"]) ? " visible" : " hidden";
        }
        return className;
      })
      .style("stroke", function(d) { return d.color; });

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
    renderer.links.style("marker-end", function(d) {
      if(d.temp) return "none";
      return "url(#suit)";
    });
  }    
};

renderer.drawCurvedLinks = function() {
  renderer.diagonal = d3.svg.diagonal()
        .source(function(d) { return {"x":d.source.x, "y":d.source.y}; })            
        .target(function(d) { return {"x":d.target.x, "y":d.target.y}; })
        .projection(function(d) { return [d.x, d.y]; });

  renderer.links = renderer.svg.selectAll(".link")
      .data(graph.spec.links)
    .enter().append("path")
      .attr("class", function(d) {
        var className = "link";
        if(d._temp) {
          className += (renderer.options["layoutnode"]) ? " visible" : " hidden";
        }
        return className;
      })
      .attr("d", renderer.diagonal)
      .style("stroke", function(d) { return d.color; })
      .style("fill", "transparent");

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
    renderer.links.style("marker-end", function(d) {
      if(d.temp) return "none";
      return "url(#suit)";
    });
  }
}

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
      .attr("class", function(d) {
        var className = "node";
        if(d.temp) {
          className += (renderer.options["layoutnode"]) ? " visible" : " hidden";
        }
        return className;
      })
      .attr("width", function(d) { return d.width - 2 * d.padding; })
      .attr("height", function(d) { return d.height - 2 * d.padding; })
      .attr("rx", renderer.options["nodesize"])
      .attr("ry", renderer.options["nodesize"])
      .style("fill", graph.getColor)
    .call(renderer.colajs.drag);

  // Prevent interaction with nodes from causing pan on background.
  renderer.nodes
    .on("click", renderer.opacity)
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
  // Update the links
  if(renderer.options["curved"]) {
    renderer.links.attr("d", renderer.diagonal);
  } else {
    renderer.links
        .attr("x1", function (d) { return d.source.x; })
        .attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; })
        .attr("y2", function (d) { return d.target.y; });
  }

  // Update the nodes
  renderer.nodes
      .attr("x", function (d) { return (d.fixed) ? d.x : d.x - d.width / 2 + d.padding; })
      .attr("y", function (d) { return (d.fixed) ? d.y : d.y - d.height / 2 + d.padding; });

  // Update the groups
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

renderer.opacity = function(node) {
  d3.event.stopPropagation();
  var neighbors = [];
  d3.selectAll(".link")
      .style("opacity", function(d) {
        if(node && ((node._id != d.source._id && node._id != d.target._id) || d._temp)) {
          return 0.15;
        } else if(d3.select(this).attr("class").indexOf("hidden") != -1) {
          return 0;
        } else {
          if(neighbors.indexOf(d.source._id) == -1) neighbors.push(d.source._id);
          if(neighbors.indexOf(d.target._id) == -1) neighbors.push(d.target._id);
          return 1;
        }
      });

  d3.selectAll(".node")
      .style("opacity", function(d) {
        if(node && neighbors.indexOf(d._id) == -1) {
          return 0.15;
        } else if(d3.select(this).attr("class").indexOf("hidden") != -1) {
          return 0;
        } else {
          return 1;
        }
      });
};

renderer.highlight = function(nodes) {
  if(renderer.options["debugprint"]) console.log("  Highlighting: ", nodes);
  var ids = nodes.map(function(n) { return n._id; });
  d3.selectAll(".node")
      .filter(function(node) { return ids.indexOf(node._id) != -1; })
      .style("stroke", "red")
      .style("stroke-width", 3);
};

renderer.removeHighlight = function(nodes) {
  d3.selectAll(".node")
      .filter(function(node) { return node.temp == null; })
      .style("stroke-width", 0);
};

renderer.showError = function() {
  var color = d3.scaleSequential(d3.interpolateYlOrRd);
  renderer.nodes.style("fill", function(d) { 
        var err = validator.errors[d._id] / validator.maxError || 0;
        return color(err); 
      })
    .on("click", function(d) {
      var invalid = validator.getInvalidConstraints(d);
      console.log("Node " + d._id + " has " + validator.errors[d._id] + " invalid constraints: ", invalid);
    });
};