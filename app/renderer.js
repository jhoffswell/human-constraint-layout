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

  // Add nodes/edges to create curved edges
  if(renderer.options["curved"]) {
    var nodeById = d3.map(graph.spec.nodes, function(d) { return d._id; });
    renderer.bilinks = [];
    graph.spec.links.forEach(function(link) {
      var s = nodeById.get(link.source);
      var t = nodeById.get(link.target);
      var i = Node();
      i._curved = i.temp = true;
      graph.spec.nodes.push(i);
      i._id = graph.spec.nodes.indexOf(i);

      graph.spec.links.push({source: s._id, target: i._id, _temp: true}, {source: i._id, target: t._id, _temp: true});
      renderer.bilinks.push([s, i, t]);
    });
  }

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
    .call(zoom);

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
  renderer.links = renderer.svg.selectAll(".clink")
      .data(renderer.bilinks)
    .enter().append("path")
      .attr("class", function(d) {
        var className = "clink";
        if(d._temp) {
          className += (renderer.options["layoutnode"]) ? " visible" : " hidden";
        }
        return className;
      })
      .attr("d", function(d) {
        return "M" + d[0].x + "," + d[0].y
             + "S" + d[1].x + "," + d[1].y
             + " " + d[2].x + "," + d[2].y;
      })
      .style("stroke", function(d) { 
        var link = graph.spec.links.filter(function(link) {
          return link.source._id == d[0]._id && link.target._id == d[2]._id;
        })[0];
        return link.color || "lightgray"; 
      })
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
  var nodes = graph.spec.nodes.filter(function(node) { return !node._curved; });

  renderer.nodes = renderer.svg.selectAll(".node")
      .data(nodes)
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
    renderer.links
        .attr("d", function(d) {
          return "M" + d[0].x + "," + d[0].y
               + "S" + d[1].x + "," + d[1].y
               + " " + d[2].x + "," + d[2].y;
        });
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