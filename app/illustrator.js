var illustrator = {};

var icons = {
	'fill': 'paint-brush'
};

illustrator.init = function() {

	illustrator.sets = [];

	illustrator.reset();
	illustrator.generateDataTable();
	illustrator.createNewSet();
};

illustrator.reset = function() {
	d3.select('#data-panel').selectAll('*').remove();
	d3.selectAll('.set').remove();
};

illustrator.generateDataTable = function() {
	var properties = graph.properties;
	var table = d3.select('#data-panel').append('table')
			.attr('class', 'node-data');

	// Create the table header
	table.append('tr').selectAll('th')
			.data(properties)
		.enter().append('th')
			.html(function(d) { return d; });

	// Create several of the table rows
	var data = graph.spec.nodes.slice(0,5);
	data.forEach(function(node) {
		table.append('tr').selectAll('td')
				.data(properties)
			.enter().append('td')
				.html(function(d) { return node[d]; })
				.style('font-weight', 'regular');
	});
};

illustrator.createNewSet = function() {
	var index = document.getElementById('collections').children.length;
	illustrator.sets.push('');
	var div = d3.select('#collections').append('div')
			.attr('class', 'set #' + index);

	// Create the set name
	div.append('span')
			.html('Name:  ');
	div.append('input')
			.attr('type', 'text')
			.on('input', function() {
				var newValue = this.value;
				var exists = false;
				illustrator.sets.forEach(function(name, i) {
					if(name === newValue && i !== index) exists = true; 
				});
				if(exists) {
					div.append('span')
							.attr('class', 'fa fa-exclamation-circle')
							.attr('title', 'Name conflicts with existing collection.')
							.style('padding', '0px 5px')
							.style('color', 'firebrick');
				} else {
					div.selectAll('.fa-exclamation-circle').remove();
					illustrator.sets[index] = newValue;
				}
			});
	div.append('span')
			.attr('class', 'fa fa-chevron-circle-down')
};

illustrator.showRecommendations = function() {

	var div = d3.select('.set_recommendations')
			.style('display', 'flex');

	d3.selectAll('.recommendation').remove();

	div.selectAll('.recommendation')
			.data(illustrator.recommendation)
		.enter().append('div')
			.text(function(d) { return d; })
			.attr('class', function(d,i) { 
				if(i===0) return 'recommendation selected';
				return 'recommendation';
			})
		.on('mouseover', illustrator.recolorGraph);

	illustrator.recolorGraph(illustrator.recommendation[0]);

};

illustrator.recolorGraph = function(property) {

	var color;
	var domain = graph.spec.nodes.map(m=>m[property]);
	if(typeof graph.spec.nodes[0][property] == 'string') {
		color = d3.scaleOrdinal(d3.schemeDark2).domain(domain);
	} else {
		color = d3.scaleSequential(d3.interpolateYlGnBu).domain(d3.extent(domain));
	}

	d3.selectAll('rect.node')
			.style('fill', function(d) { return color(d[property]); });
}

illustrator.nodeSelection = function(nodes) {
	var numSelected = nodes._groups[0].length;
	var result = {};
	graph.properties.forEach(function(prop) { result[prop] = []; });
	nodes._groups[0].forEach(function(node) {
		var data = d3.select(node).datum();
		graph.properties.forEach(function(property) {
			if(result[property].indexOf(data[property]) === -1) result[property].push(data[property]);
		});
	});

	// Sort the properties
	var sorted = Object.keys(result).sort(function(a,b) {
		return result[a].length >= result[b].length;
	});
	var filtered = sorted.filter(function(r) { 
		return result[r].length !== numSelected;
	});

	illustrator.recommendation = filtered;
	illustrator.showRecommendations();
};