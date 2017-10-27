var prevalence = graph.spec.nodes.map(function(node) { return node.prevalence; });
var shared = graph.spec.links.map(function(link) { return link.shared; });

var size = d3.scaleLinear().domain(d3.extent(prevalence)).range([20,150]);
var width = d3.scaleLinear().domain(d3.extent(shared)).range([1,10]);

graph.spec.nodes.forEach(function(node) { 
  node.width = size(node.prevalence);
  node.height = size(node.prevalence);
});

d3.selectAll(".node")
    .attr("width", function(d) { return size(d.prevalence); })
    .attr("height", function(d) { return size(d.prevalence); })
    .attr("rx", function(d) { return size(d.prevalence); })
    .attr("ry", function(d) { return size(d.prevalence); })
    .style("opacity", 0.75);
d3.selectAll(".link")
    .style("stroke-width", function(d) { return width(d.shared); })
    .style("opacity", 0.75);