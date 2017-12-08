function createSet(elements, definition) {
	if(renderer.options['debugprint']) console.log('    Create set ', definition, '...');

	elements = elements.filter(function(element) { return !element.temp; });

	// Process the new set.
	var set = [];
	if(!definition) {
		set = [elements];
	} else if(definition.partition) {
		set = partitionSet(elements, definition);
	} else if(definition.collect) {
		set = collectSet(elements, definition);
	} else if(definition.expr) {
		set = exprSet(elements, definition);
	} else if(typeof(definition) === 'string') {
		set = existingSet(elements, definition);
	} else {
		definition.forEach(function(subdef, index) {
			set.push(createSet(elements, subdef, index));
		});
	}

	return set;
};

function partitionSet(elements, definition) {
	var partitionSets = {};

	// Split the elements into sets based on their partition property.
	elements.forEach(function(element) {
		var partitionValue = element[definition.partition];
    if(definition.partition === 'parent' && partitionValue) {
      partitionValue = partitionValue._id; 
      console.warn('Just testing this now.')
    }
    console.log('***partition', element, definition.partition, partitionValue)
		if(definition.ignore && contains(definition.ignore, partitionValue)) return;
		if(definition.include && !contains(definition.include, partitionValue)) return;
		if(!partitionSets[partitionValue]) partitionSets[partitionValue] = [];
		partitionSets[partitionValue].push(element);
	});

	// Lift the partition property to a property of the set.
	Object.keys(partitionSets).forEach(function(setName) {
		partitionSets[setName][definition.partition] = partitionSets[setName][0][definition.partition];
	});

	return Object.keys(partitionSets).map(function(setName) { return partitionSets[setName]; });
};

function collectSet(elements, definition) {
  var collectSets = {};
  elements.forEach(function(element) {
    var set = [];
    definition.collect.forEach(function(expr) {
      switch(expr) {
        case 'node':
          set.push(element);
          break;
        case 'node.firstchild':
          console.log('kids', element.firstchild)
          if(element.firstchild) set = set.concat(element.firstchild);
          break;
        case 'node.children':
          set = set.concat(element.children);
          break;
        case 'node.neighbors':
          var neighbors = element.neighbors.map(function(link) {
            var id = link.source === element ? link.target : link.source;
            return graph.spec.nodes[id];
          });
          console.log('******NEIGHBORS ARE: ', element, neighbors)
          set = set.concat(neighbors);
          break;
        case 'node.incoming':
          set = set.concat(element.incoming);
          break;
        case 'node.outgoing':
          set = set.concat(element.outgoing);
          break;
        default:
          if(expr.indexOf('sort') !== -1) {
            console.warn('Just testing this now.');
            var children = element.outgoing.map(function(link) {
              return graph.spec.nodes[link.target];
            });
            var map = children.map(function(el) { return el.value; });
            var sorted = map.sort();
            var first = children.filter(function(el) {
              return el.value === sorted[0];
            });
            console.log('for', element.name, sorted)
            if(first[0]) set = set.concat(first[0]);
          } else {
            console.error('Unknown collection parameter \'' + expr + '\'');
          }
      }
    });
    if(set.length > 1) collectSets[element._id] = set;
  });
  return Object.keys(collectSets).map(function(setName) { return collectSets[setName]; });
};

function exprSet(elements, definition, index) {
  console.log('ExprSet', elements, definition)
  var set = [];
  elements.forEach(function(element) {
    var matches = definition.expr.match(/node\.[a-zA-Z.0-9]+/g);
    var expr = definition.expr;
    matches.forEach(function(match) {
      var props = match.replace('node.', '').split('.');
      var result;
      for (var i = 0; i < props.length; i++) {
        result = element[props[i]];
      }
      expr = expr.replace(match, JSON.stringify(result));
    });
    if(eval(expr)) set.push(element);
  });

  set._exprIndex = index;
  return set;
};

function existingSet(elements, definition) {
	return layout.sets[definition];
};