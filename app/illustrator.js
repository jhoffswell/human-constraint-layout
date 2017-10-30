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
	var properties = Object.keys(graph.spec.nodes[0]);
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
	var index = d3.select('#collections')[0][0].children.length;
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