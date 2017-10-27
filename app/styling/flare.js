d3.selectAll(".node")
    .style("fill", function(d) {
      var color;
      if(d.depth == 0) {
        color = "#000002";
      } else if(d.depth == 1) {
        color = "#3F006B";
      } else if(d.depth == 2) {
        color = "#A81C66";
      } else if(d.depth == 3) {
        color = "#FB734A";
      } else {
        color = "#FCFFAE";
      }
      return color;
    })
    .style("stroke", "white")
    .style("stroke-width", 2);