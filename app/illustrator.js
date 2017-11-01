var illustrator = {};

var icons = {
	'fill': 'paint-brush'
};

illustrator.init = function() {

	illustrator.sets = [];

	illustrator.reset();
	illustrator.generateDataTable();
	var newset = illustrator.createNewSet();
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

	d3.selectAll('.set').classed('selected', false);

	var index = document.getElementById('collections').children.length;
	illustrator.sets.push('');
	var div = d3.select('#collections').append('div')
			.attr('class', 'set #' + index)
			.classed('open', true)
			.classed('selected', true);
	illustrator.selected = div;

	// Create the set specification header
	var header = div.append('div');
	header.append('span')
			.html('Name:  ');
	header.append('input')
			.attr('type', 'text')
			.on('input', function() {
				var newValue = this.value;
				var exists = false;
				illustrator.sets.forEach(function(name, i) {
					if(name === newValue && i !== index) exists = true; 
				});
				if(exists) {
					header.append('span')
							.attr('class', 'fa fa-exclamation-circle')
							.attr('title', 'Name conflicts with existing collection.')
							.style('padding', '0px 5px')
							.style('color', 'firebrick');
				} else {
					header.selectAll('.fa-exclamation-circle').remove();
					illustrator.sets[index] = newValue;
				}
			});
	header.append('span')
			.attr('class', 'fa fa-chevron-circle-up')
			.on('click', function() {
				toggleSetSpec(d3.select(this.parentNode.parentNode));
				d3.event.stopPropagation();
			});

	// Create the set specification contents
	var contents = div.append('div')
			.attr('class', 'setspec');

	// Set Specification
	var sets = contents.append('div').attr('class', 'contents')
	sets.append('span')
			.html('Sets: ');
	sets.append('input')
			.attr('id', 'set-input')
			.attr('type', 'text');

	// Add interaction to the set specification
	div.on('click', function() { 
		d3.selectAll('.set').classed('selected', false);
		d3.select(this).classed('selected', true);
		illustrator.selected = d3.select(this);
		illustrator.recolorGraph(d3.select(this).select('#set-input').attr('value'))
		
		if(d3.select(this).classed('closed')) {
			toggleSetSpec(d3.select(this));
		}

	});

	return div;
};

function toggleSetSpec(div) {
	div.classed('closed', !div.classed('closed'));
	div.classed('open', !div.classed('open'));

	if(div.classed('open')) {
		div.select('.fa').attr('class', 'fa fa-chevron-circle-up');
	} else {
		div.select('.fa').attr('class', 'fa fa-chevron-circle-down');
		div.classed('selected', false);
		if(illustrator.selected && illustrator.selected.attr('class') === div.attr('class')) {
			illustrator.selected = null;
		}
	}
};

function setSpecification(result) {

	var string = '';
	if(result === 'EXACT') {
		d3.selectAll('.node.selected')._groups[0].forEach(function(node) {
			string += 'node._id===' + d3.select(node).datum()._id + '||';
		});
		string = string.slice(0, string.length-2);
	} else {
		string = result;
	}

	illustrator.selected.select('#set-input').attr('value', string);
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
		.on('mouseover', function(d) {
			illustrator.recolorGraph(d);
			setSpecification(d);
		})
		.on('mouseout', function() {
			var prop = d3.select('.recommendation.selected').datum();
			illustrator.recolorGraph(prop);
			setSpecification(prop);
		})
		.on('click', function(d) {
			illustrator.recolorGraph(d);
			setSpecification(d);
			d3.selectAll('.recommendation').classed('selected', false);
			d3.select(this).classed('selected', true);
		});

	illustrator.recolorGraph(illustrator.recommendation[0]);
	setSpecification(illustrator.recommendation[0]);

};

illustrator.recolorGraph = function(property) {
	if(property === 'EXACT') {
		d3.selectAll('rect.node')
				.style('fill', '#aaa');
		d3.selectAll('.node.selected').selectAll('rect')
				.style('fill', '#6363b5');
	} else if(property.indexOf('===') !== -1) {
		// TODO: Figure out how to recolor from the expr
	} else {
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
}

illustrator.nodeSelection = function(nodes) {

	if(!illustrator.selected) illustrator.createNewSet();
	illustrator.selectedNodes = nodes;

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

	illustrator.recommendation = filtered.concat(['EXACT']);
	illustrator.showRecommendations();
};