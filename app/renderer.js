var renderer = {};
var style = styling;

/***************************************************************/
/************************ GRAPH DRAWING ************************/
/***************************************************************/

renderer.init = function() {
  renderer.options = {};
  document.getElementById("range-noconst").value =  50;
  document.getElementById("range-userconst").value = 100;
  document.getElementById("range-layoutconst").value = 200;
  document.getElementById("range-linkdist").value = 50;
  document.getElementById("range-jaccard").value = 0;
  document.getElementById("range-symmetric").value = 0;
  document.getElementById("range-constgap").value = 0;
  document.getElementById("range-nodesize").value = 20;
  document.getElementById("range-nodepad").value = 0;

  document.getElementById("check-debugprint").checked = true;
  document.getElementById("check-layoutnode").checked = false;
  document.getElementById("check-layoutboundary").checked = false;
  document.getElementById("check-setnode").checked = false;
  document.getElementById("check-overlaps").checked = true;
  document.getElementById("check-arrows").checked = false;
  document.getElementById("check-curved").checked = true;

  document.getElementById("text-fillprop").value = "_id";

  ["noconst", "userconst", "layoutconst", "linkdist", "jaccard", "symmetric", "constgap", "nodesize", "nodepad"].map(updateRange);
  ["debugprint", "layoutnode", "layoutboundary", "setnode", "overlaps", "arrows", "curved"].map(updateCheck);
  ["fillprop"].map(updateText);
};

renderer.setStyle = function(name) {
  switch(name) {
    case 'small-foodWeb':
      style = kruger;
      break;
    case 'serengeti-foodWeb':
      style = serengeti;
      break;
    case 'syphilis':
      style = syphilis;
      break; 
    default:
      style = styling;
  };
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
      .convergenceThreshold(1e-3)
      .handleDisconnected(false);

  if(renderer.options["linkdist"] != 0 ) {
    renderer.colajs.linkDistance(function(d) {
      var linkDistance = renderer.options["linkdist"];
      if(d.hasOwnProperty('temp')) linkDistance = renderer.options["nodesize"]/2;
      if(d.hasOwnProperty('length')) linkDistance = d.length;
      return linkDistance;
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

  // Draw the boundaries
  if(renderer.options["layoutboundary"]) renderer.showLayoutBoundaries();
};

renderer.drawLinks = function() {

  //var links = graph.spec.links.filter(function(link) { return !link._temp; });

  renderer.links = renderer.svg.selectAll(".link")
      .data(graph.spec.links)
    .enter().append("line")
      .attr("class", function(d) {
        var className = "link";
        if(d.temp) {
          if(renderer.options["layoutnode"]) className += " visible";
          if(!renderer.options["layoutnode"]) className += " hidden";
        }
        return className;
      })
      .style("stroke", function(d) { 
        if(d.guide) return "red";
        if(renderer.options["layoutnode"] && d.temp) return "#ddd";
        return d.color; 
      })
      .style("stroke-dasharray", function(d) {
        if(d.style === "dashed") return "3 3";
      });

  if(renderer.options["arrows"]) {
    
    renderer.svg.append("defs").selectAll("marker")
        .data(["suit", "licensing", "resolved"])
      .enter().append("marker")
        .attr("id", function(d) { return d; })
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25) // TODO: originally 25
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("path")
        .attr("d", "M0,-5L10,0L0,5 L10,0 L0, -5");
    
    renderer.links
        .style("marker-end", function(d) {
          if(d.temp) return "none";
          return "url(#suit)";
        })
        .style("stroke", function(d) { return d.color; });
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
        if(d.temp) {
          if(renderer.options["layoutnode"]) className += " visible";
          if(!renderer.options["layoutnode"]) className += " hidden";
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
        .attr("r", function(d) {
          if(d.size) return d.size/2;
          return renderer.options["nodesize"] / 2
        })
        .style("fill", graph.getColor)
      .call(renderer.colajs.drag);

  renderer.nodes.append("title").text(graph.getLabel);
};

renderer.drawUnlabeledNodes = function() {
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
      .attr("rx", function(d) {
        return 0;
        // return d.size ? d.size : renderer.options["nodesize"];
      })
      .attr("ry", function(d) {
        return 0;
        // return d.size ? d.size : renderer.options["nodesize"];
      })
      .style("fill", graph.getColor)
      .style("stroke", graph.getStroke)
    .call(renderer.colajs.drag);

  // Prevent interaction with nodes from causing pan on background
  renderer.nodes
    .on("click", renderer.opacity)
    .on("mousedown", function() { d3.event.stopPropagation(); })
    .on("mousemove", function() { d3.event.stopPropagation(); });

  renderer.nodes.append("title").text(graph.getLabel);
  
};

renderer.drawNodes = function() {
  renderer.nodes = renderer.svg.selectAll(".node")
      .data(graph.spec.nodes)
    .enter().append("g")
      .attr("class", function(d) {
        var className = "node";
        if(!d.temp) className += " basic";
        return className;
      })
    .call(renderer.colajs.drag);

  renderer.nodes.append("rect")
      .attr("class", function(d) {
        var className = "node";
        if(d.temp) {
          className += (renderer.options["layoutnode"]) ? " visible" : " hidden";
        }
        return className;
      })
      .attr("width", function(d) { return d.width - 2 * d.padding; })
      .attr("height", function(d) { return d.height - 2 * d.padding; })
      .attr("rx", function(d) {
        return 0;
        // return d.size ? d.size : renderer.options["nodesize"];
      })
      .attr("ry", function(d) {
        return 0;
        // return d.size ? d.size : renderer.options["nodesize"];
      })
      .style("fill", graph.getColor)
      .style("stroke", graph.getStroke);

  // Prevent interaction with nodes from causing pan on background
  renderer.nodes
    .on("click", renderer.opacity)
    .on("mousedown", function() { d3.event.stopPropagation(); })
    .on("mousemove", function() { d3.event.stopPropagation(); });

  renderer.nodes.append("title").text(graph.getLabel);

  var showLabels = true;
  if(showLabels) {
    var nodes = renderer.nodes;
    if(!renderer.options["layoutnode"]) {
      nodes = d3.selectAll(".basic");
    }
    var text = nodes.append("text").text(style.label);
    text.attr("class", "text-label")
        .attr("dx", style.dx)
        .attr("dy", style.dy)
        .style("fill", style.color)
        .style("font-size", style.size)
        .style("font-style", style.style);
  }
  
};

renderer.drawGroups = function() {
  renderer.groups = renderer.svg.selectAll(".group")
        .data(graph.spec.groups)
      .enter().append("rect")
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("class", "group")
        .style("fill", "#D6F6CC")
        .style("opacity", function(d) {
          if(d.style === 'visible') return 0.85;
          return 0;
        })
      .call(renderer.colajs.drag);
};

var CIRCLE = false;
renderer.tick = function() {

  if(CIRCLE) renderer.circle();

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
  // TODO: This is what we had before changing the node to a group with text.
  // renderer.nodes
  //     .attr("x", function (d) { return d.fixed ? d.x : d.x - d.width / 2 + d.padding; })
  //     .attr("y", function (d) { return d.fixed ? d.y : d.y - d.height / 2 + d.padding; });

  renderer.nodes.attr("transform", function(d) { 
    if(d.fixed) {
      return "translate(" + d.x + "," + d.y + ")";
    } else {
      var x = d.x - d.width / 2 + d.padding;
      var y = d.y - d.height / 2 + d.padding;
      return "translate(" + x + "," + y + ")"; 
    }
  })

  if(renderer.options["layoutboundary"]) renderer.showLayoutBoundaries();

  // Update the groups
  if(!renderer.groups) return;
  renderer.groups
      .attr("x", function (d) { return d.bounds.x; })
      .attr("y", function (d) { return d.bounds.y; })
      .attr("width", function (d) { return d.bounds.width(); })
      .attr("height", function (d) { return d.bounds.height(); });
};

function lock() {
  var nodes = graph.spec.nodes.map(function(node) {
    node.fixed = true;
    return node;
  });
  renderer.colajs.nodes(nodes);
};

function zoomed() {
  renderer.colajs.stop();
  renderer.svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");

  // Modify the visual boundaries
  var width = d3.select("svg").style("width").replace("px", "");
  var height = d3.select("svg").style("height").replace("px", "");
  var newWidth = width / d3.event.scale;
  var newHeight = height / d3.event.scale;
  var padding = 50;
  d3.selectAll(".boundary")
      .attr("x1", function(d) { return d.boundary === "x" ? d.x : padding; })
      .attr("x2", function(d) { return d.boundary === "x" ? d.x : newWidth-padding*2; })
      .attr("y1", function(d) { return d.boundary === "y" ? d.y : padding; })
      .attr("y2", function(d) { return d.boundary === "y" ? d.y : newHeight-padding*2; })
      .attr("transform", function(d) {
        var translate;
        if(d.boundary === "x") {
          translate = d3.event.translate[0] + ",0";
        } else {
          translate = "0," + d3.event.translate[1];
        }
        return "translate(" + translate  + ")scale(" + d3.event.scale + ")";
      });
  d3.selectAll(".boundary-text")
      .attr("transform", function(d) {
        var translate;
        if(d.boundary === "x") {
          translate = d3.event.translate[0] + ",0";
        } else {
          translate = "0," + d3.event.translate[1];
        }
        return "translate(" + translate  + ")scale(" + d3.event.scale + ")";
      })
      .style("font-size", function(d) { 
        return 12/d3.event.scale + "px";
      });

};

renderer.opacity = function(node) {
  d3.event.stopPropagation();
  if(node && node.temp) return;
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
  renderer.nodes.selectAll("rect").style("fill", function(d) { 
        var err = validator.errors[d._id] / validator.maxError || 0;
        return color(err); 
      })
    .on("click", function(d) {
      var invalid = validator.getInvalidConstraints(d);
      console.log("Node " + d._id + " has " + validator.errors[d._id] + " invalid constraints: ", invalid);
    });
};

renderer.showLayoutBoundaries = function() {
  var boundaries = graph.spec.nodes.filter(function(node) { return node.boundary; });
  if(boundaries.length === 0) return;

  // Process the boundaries to split the x and y.
  for (var i = 0; i < boundaries.length; i++) {
    if(boundaries[i].boundary === "xy") {
      console.log("found xy boundary!")
      var duplicate = Object.assign({}, boundaries[i]);
      boundaries[i].boundary = "x";
      duplicate.boundary = "y";
      boundaries.push(duplicate);
    }
  };

  // Draw the boundaries.
  var width = d3.select("svg").style("width").replace("px", ""),
      height = d3.select("svg").style("height").replace("px", "");
  var padding = 50;
  var boundary_line = d3.select(".graph").selectAll(".boundary")
      .data(boundaries)
      .attr("x1", function(d) {
        return d.boundary === "x" ? d.x : padding;
      })
      .attr("x2", function(d) {
        return d.boundary === "x" ? d.x : width-padding*2;
      })
      .attr("y1", function(d) {
        return d.boundary === "y" ? d.y : padding;
      })
      .attr("y2", function(d) {
        return d.boundary === "y" ? d.y : height-padding*2;
      });
  
  boundary_line.enter().append("line").attr("class", "boundary");

  var boundary_text = d3.select(".graph").selectAll(".boundary-text")
      .data(boundaries)
      .attr("x", function(d) { return position = d.boundary === "x" ? d.x + 10 : padding; })
      .attr("y", function(d) { return position = d.boundary === "y" ? d.y - 10 : padding + 10; });
  
  boundary_text.enter().append("text")
      .attr("class", "boundary-text")
      .text(function(d) { 
        var string = d.name || d.temp_name;
        if(!string && d._type) string = d._type + " position " + Math.round(d[d.boundary]);
        if(!string) string = "position ~" + Math.round(d[d.boundary]);
        return string;
      });
};

renderer.circle = function() {
  var root = graph.spec.nodes.filter(function(node) { return node.depth == 0; })[0];
  var position = graph.spec.nodes.map(function(node) { return node.x; });
  for (var depth = 0; depth < 5; depth++) {
    var nodes = graph.spec.nodes.filter(function(node) { return node.depth == depth; });

    var linear = d3.scaleLinear()
        //.domain(d3.extent(nodes.map(function(node) { return node.x; })))
        .domain(d3.extent(position))
        .range([0,2*Math.PI]);

    nodes.forEach(function(node) {
      var p = d3.pointRadial(linear(node.x), node.y - root.y);
      node.x = p[0];
      node.y = p[1];
    });
  };

  d3.selectAll(".node")
      .attr("x", function(d) { return d.x; })
      .attr("y", function(d) { return d.y; });
};

// A function to remove overlaps from the graph.
// NOTE: This does not work with the layout, so it is not all that helpful.
renderer.removeOverlaps = function() {
  renderer.colajs.stop();
  var rs = new Array(renderer.nodes[0].length);
  renderer.nodes[0].forEach(function (r, i) {
    var node = d3.select(r);
    var x = Number(node.attr("x"));
    var y = Number(node.attr("y"));
    var w = Number(node.attr("width"));
    var h = Number(node.attr("height"));
    rs[i] = new cola.Rectangle(x, x + w, y, y + h);
  });
  console.log("rects", rs)
  cola.removeOverlaps(rs);
  var animate = false;

  var nodes = renderer.colajs.nodes();
  renderer.nodes
      .attr("x", function(d,i) {
        var t = rs[i];
        d.x = t.x;
        nodes[i].x = d.x;
        console.log(nodes[i].x == t.x, nodes[i].x, d.x, t.x)
        return d.x;
      })
      .attr("y", function(d,i) {
        var t = rs[i];
        d.y = t.y;
        nodes[i].y = d.y;
        return d.y;
      });
  renderer.colajs.nodes(nodes);
  renderer.tick();
};