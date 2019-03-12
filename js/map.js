(function(){
	var initialZoom = 13;
 	var map = L.map('mapid').setView([31.518014, 74.326557], initialZoom);
 	var tileLayer = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
	    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
	    maxZoom: 15,
		minZoom : 11,
		reuseTiles : true,
	    id: 'mapbox.light',
	    accessToken: 'pk.eyJ1IjoiZGFuaWFsc2FkaXFtYXNvb2Q0NCIsImEiOiJjam1nNDQydWg2aGJsM3BxdjAwMDBrZDF1In0.hQKu9lmCPflEijaDBSWYYg'
	});
	tileLayer.addTo(map);

	var tilesLoadedPromise = new Promise(function(resolve, reject){
		tileLayer.on('load', function(e){
			resolve(e);
		});
	});

	var monthData = generateData();

	var svgLayer = L.svg();
	svgLayer.addTo(map);

	var svg = d3.select("#mapid").select("svg");
	var g = d3.select("#mapid").select("svg").select('g');
	g.attr("class", "leaflet-zoom-hide");

	map.on("zoom", update);
	var currMPP = getMetresPerPixel();

	originalMMP = getMetresPerPixel();

	function update() {

		var prevMPP = currMPP;
		currMPP = getMetresPerPixel();

		var rescaleFactor = originalMMP/getMetresPerPixel();

		//console.log(rescaleFactor);

		d3.selectAll('.map-container circle').attr("cx",
		function(d) {
			return map.latLngToLayerPoint(d.latLng).x;
		})
		.attr("cy",
		function(d) {
			return map.latLngToLayerPoint(d.latLng).y;
		})
		.style('r', function(d){
			return getRadius(d.data);
		})
		.style('stroke-width', function(d){
			return getRadius(d.data) /8;
		});
	}

	function createBubblesForDay(day,dataArr){

		//console.log(day);

		var _reject;

		var rejectablePromise = new Promise(function(resolve, reject){
			//set _reject so promise may be externally rejected
			_reject = reject;

			var data = dataArr[day];

			var hover = document.getElementById('hoverbox');
			if(hover){
				hover.remove();
			}

			//update week
			d3.select('#map-week').text(getWeekString(data[0].data.week, data[0].data.year));
			//fade out and remove circles
			feature = g.selectAll('circle');
			var featureNodes = feature.nodes();
			waitForAllWAAPI(
				function (d){
					return {
						keyframes : [{opacity : window.getComputedStyle(this).opacity} , {opacity : 0}],
						options : {duration : 300, easing : 'ease-in'}
					};
				},
				featureNodes
			) //join data using d3 and append circles
			.then(function(){
				feature.remove();

				feature = g.selectAll('circle')
						.data(data)
					.enter()
						.append('circle')
		    			.style('opacity', 0)
		    			.style('fill', 'rgb(51, 48, 131)')
		    			.style('stroke', 'rgb(89, 86, 162)')
			    		.style('stroke-width', function(d){
			    			return getRadius(d.data) /8;
			    		})
			    		.attr('r', 50);

				//update position using forceSim

				forceSim(data);
				data.forEach(function(d){
					var point = xyToLatLng(d.x, d.y);
					d.latLng = point;
				});

				//set correct circle centers and add listeners
				feature.attr("cx",
					function(d) {
						return d.x;
					})
					.attr("cy",
					function(d) {
						return d.y;
					})
					.attr("pointer-events","visible")
					.on('mousemove', function(d){
						//player.showToolTip();
						showTooltip(d3.event,d.data);
					})
					.on('mouseout', function(d){
						//player.showToolTip();
					//	console.log(player.day);
						var hover = document.getElementById('hoverbox');
						if(hover){
							hover.remove();
						}
						resumeAllWAAPI(document.querySelectorAll('.map-container circle'));
					});

				//set correct radius
				return waitForAllWAAPI(function (d){
					return {
						keyframes : [
							{
								opacity : window.getComputedStyle(this).opacity,
								r : 0
							},
							{
								opacity : 0.6,
								r : getRadius(d.data)
							}
						],
						options : {duration : 300, easing : 'ease-in', fill : 'forwards'}
					};
				}, feature.nodes(), true);
			})
			.then(function(){ //wait for 1s (stop waiting when paused);
				return waitForAllWAAPI(function (d){
					return {
						keyframes : [{},{}],
						options : 1000
					};
				}, feature.nodes());
			})
			.then(function(){
			//	console.log('resolved');
				resolve();
			});
		});

		rejectablePromise.reject = _reject;
		return rejectablePromise;
	}

	function cancelBubbleAnimation(){
		return waitForAllSelectionTransactions(feature.transition().duration(0));
	}

	function createBubblesForMonth(days, day){
		return new Promise(function(resolve, reject){
			if(day >= days){
				return;
			}

			bPromise = createBubblesForDay(day);
			bPromise.then(function(){
				createBubblesForMonth(days, ++day);
				resolve();
			});
		});
	}

	function createPlayer(data){

		var playingState = {
			name : 'playing',
			pause : function(){
				player.transition('paused');
				player.animationPromise.reject();
			},
			animateCircles : function(){

				if(player.day >= player.data.length){
					return Promise.resolve();
				}

				changeSliderValue(player.day);

				player.animationPromise = createBubblesForDay(player.day, player.data);
				player.animationPromise.then(()=>{
					player.day += 1;
					player.animateCircles();
				})
				.catch(function(){
					if(player.day < player.data.length){
						player.day +=1;
					}
				});
			},
			handleDayChange : function(){
				player.transition('playingMD');
				player.startDayChange();
			}
		};

		var pausedState = {
			name : 'paused',
			play : function(){
				player.transition('playing');
				player.animateCircles();
			},
			handleDayChange : function(day){
				player.transition('pausedMD');
			}
		};

		var playingMDState = {
			name : 'playingMD',
			startDayChange : function(){
				//player.animationPromise.reject();
				pauseAllWAAPI(document.querySelectorAll('.map-container circle'));
			},
			finishDayChange : function(day){
				player.day = day;
				player.play();
			}
		};

		var pausedMDState = {
			name : 'pausedMD',
			finishDayChange : function(day){
				player.day = day;
				player.transition('paused');
				player.animationPromise = createBubblesForDay(player.day, player.data).then(()=>{
					player.day += 1;
				});
			}
		};

		var player = {
			data : data,
			state : pausedState,
			day : 0,
			play : function(){
				this.state = playingState;
				this.animateCircles();
			},
			pause : function(){
				this.state.pause();
			},
			animateCircles : function(){
				this.state.animateCircles();
			},
			transition : function(state){
				this.state = this.states[state];
			},
			handleDayChange : function(){
				this.state.handleDayChange();
			},
			startDayChange : function(){
				this.state.startDayChange();
			},
			finishDayChange : function(day){
				this.state.finishDayChange(day);
			},
			states : {
				'playing' : playingState,
				'paused' : pausedState,
				'playingMD' : playingMDState,
				'pausedMD' : pausedMDState
				}
		};

		return player;

		/*var playingState = {
			name : 'playing',
			play : function(){
				//player.transition('pause');
			},
			pause : function(){
				player.transition('paused');
			},
			iterateDays : function(){

				if(player.day >= player.data.length){
					return Promise.resolve();
				}

				slider.value = player.day;
				changeSliderValue(player.day);

				player.ctPromise = createBubblesForDay(player.day, player.data).then(()=>{
					player.day += 1;
					return player.state.iterateDays();
				});
			},
			handleDayChange : function(){
				player.transition('playingMD');
				player.state.startDayChange();
			}
		};

		var pausedState = {
			name : 'paused',
			play : function(){
				player.transition('playing');
				player.play();
			},
			pause : function(){
				//player.transition('pause');
			},
			iterateDays : function(){

			},
			handleDayChange : function(day){
				player.transition('pausedMD');
				//player.state.startDayChange();
			}
		};

		var playingMDState = {
			name : 'playingMD',
			play : function(){
				player.transition('playing');
				player.play();
			},
			pause : function(){
				//player.transition('pause');
			},
			startDayChange : function(){//
				//player.ctPromise = cancelBubbleAnimation();
				cancelAllWAAPI(document.querySelectorAll('.map-container circle'));
			},
			finishDayChange : function(day){
				/*player.ctPromise.then(function(){
					player.day = day;
					player.play();
				});*/

			/*	player.day = day;
				player.play();
			},
			handleDayChange : function(){

			},
			iterateDays : function(){

			}
		};

		var pausedMDState = {
			name : 'pausedMD',
			startDayChange : function(day){

			},
			finishDayChange : function(day){
				player.day = day;
				player.transition('paused');
				player.ctPromise = createBubblesForDay(player.day, player.data).then(()=>{
					player.day += 1;
				});
			},
			handleDayChange : function(){

			}
		};

		var player = {
			data : data,
			state : playingState,
			day : 0,
			play : function(){
				this.state = playingState;
				this.state.iterateDays();
			},
			pause : function(){
				this.state = pausedState;
				//this.state.init();
			},
			transition : function(state){
				this.state = this.states[state];
			},
			startDayChange : function(day){
				this.state.handleDayChange(day); //rename
				//this.state.startDayChange(day);
			},
			finishDayChange : function(day){
				this.state.finishDayChange(day);
			},
			states : {
				'playing' : playingState,
				'paused' : pausedState,
				'playingMD' : playingMDState,
				'pausedMD' : pausedMDState
				}
		};

		return player;*/
	}

	function generateData(){
		var arr = [];

		for(var i = 0; i < 31; i++){
			arr.push(generateArray());
		}

		return arr;

	}

	function generateArray(){
		var circleNum = Math.round(Math.random() * 20);
		circleNum = circleNum > 10 ? circleNum : 10;
		var circles = [];

		for(var i = 0; i < circleNum; i++){
			var coordinates = getRandomPoint();
			var c = {
				coordinates : coordinates,
				latLng : L.latLng(coordinates[0], coordinates[1]),
				r : Math.round(Math.random() * 60)
			};

			circles.push(c);
		}

		return circles;
	}

	function getRandomRadius(){
		return Math.round(Math.random() * 60);
	}

	var circleCenters = {
		'ENGINEERING DIRECTORATE' : '31.536491, 74.332230',
		'GIP' : '31.592360, 74.309663',
		'GORs' : ['31.545375, 74.339278', '31.545720, 74.312568', '31.535446, 74.325861'],
		'I' : '31.503473, 74.323871',
		'II' : '31.599572, 74.339665',
		'III' : '31.572990, 74.476841',
		'IV' : '31.519179, 74.267572',
		'JillaniPark' : '31.543740, 74.336698',
		'PD Ring Road' : '31.388161, 74.345296',
		'PDLBC' : '31.535128, 74.340997',
		'PHA Office Staff' : '31.540698, 74.334580',
		'Project Gulshan-e-Iqbal Park' : '31.513012, 74.288722',
		'V' : '31.521397, 74.346777',
		'VI' : '31.624500, 74.280899',
		'VII' : '31.445645, 74.305300'
	};

	function getLatLng(row){
		var zone = row.Zone;
		var circleCenter = circleCenters[zone];

		if(Array.isArray(circleCenter)){
			circleCenter = circleCenter[Math.floor(Math.random() * circleCenter.length)];
		}

		try{
			circleCenter = circleCenter.split(',');
		}catch(e){
		//	console.log(zone);
		}
		var lat = parseFloat(circleCenter[0]) + (Math.random()> 0.5 ? Math.random() * 0.005: Math.random() * 0.005 * -1);
		var lng = parseFloat(circleCenter[1] + (Math.random()> 0.5 ? Math.random() * 0.005: Math.random() * 0.005 * -1));
		return L.latLng(lat,lng);
	}

	function getRandomPoint(){
		var bounds = map.getBounds(),
			north = bounds.getNorth(),
			south = bounds.getSouth(),
			east = bounds.getEast(),
			west = bounds.getWest();

		var verticalBound = north - south;
		var horizontalBound = east - west;

		var randomLng = north - (Math.random() * verticalBound);
		var randomLat = west + (Math.random() * horizontalBound);

		return [randomLng, randomLat];
	}

	tilesLoadedPromise.then(function(){
		//update();
	});

	function getMetresPerPixel(){
		var centerLatLng = map.getCenter(); // get map center
		var pointC = map.latLngToContainerPoint(centerLatLng); // convert to containerpoint (pixels)
		var pointX = [pointC.x + 1, pointC.y]; // add one pixel to x
		var pointY = [pointC.x, pointC.y + 1]; // add one pixel to y

		// convert containerpoints to latlng's
		var latLngC = map.containerPointToLatLng(pointC);
		var latLngX = map.containerPointToLatLng(pointX);
		var latLngY = map.containerPointToLatLng(pointY);

		var distanceX = latLngC.distanceTo(latLngX); // calculate distance between c and x (latitude)
		var distanceY = latLngC.distanceTo(latLngY);

		return distanceX;
	}

	//fix later
	function getRadius(row){

		if(!row){
			return 20;
		}

		var scale = d3.scaleSqrt().domain([0,1023]).range([0,100]);
		var rescaleFactor = originalMMP/getMetresPerPixel();
		return scale(row['Surveyed'] - row['Awaiting']) * rescaleFactor//scale(row['Surveyed'] - row['Awaiting']);
	}

	var player;

	d3.csv("avg_gps_data.csv", function(data) {
		newData = {};
		for(var i=0; i < data.length; i++){
			var row = data[i];
			if(!newData[row.week + '-' + row.year]){
				newData[row.week + '-' + row.year] = [];
			}

			var currArr = newData[row.week + '-' + row.year];
			var newCircleRow = {
				data : row,
				r : getRadius(row),
				latLng : getLatLng(row)
			};

			currArr.push(newCircleRow);
		}

		newArr = Object.values(newData);
		player = createPlayer(newArr);
	  	player.play();
	});

	function getCenterFromDegrees(data)
	{
	    if (!(data.length > 0)){
	        return false;
	    }

	    var num_coords = data.length;

	    var X = 0.0;
	    var Y = 0.0;
	    var Z = 0.0;

	    for(i = 0; i < data.length; i++){
	        var lat = data[i][0] * Math.PI / 180;
	        var lon = data[i][1] * Math.PI / 180;

	        var a = Math.cos(lat) * Math.cos(lon);
	        var b = Math.cos(lat) * Math.sin(lon);
	        var c = Math.sin(lat);

	        X += a;
	        Y += b;
	        Z += c;
	    }

	    X /= num_coords;
	    Y /= num_coords;
	    Z /= num_coords;

	    var lon = Math.atan2(Y, X);
	    var hyp = Math.sqrt(X * X + Y * Y);
	    var lat = Math.atan2(Z, hyp);

	    var newX = (lat * 180 / Math.PI);
	    var newY = (lon * 180 / Math.PI);

	    return new Array(newX, newY);
	}

	function forceSim(a,p){
		var simulation = d3.forceSimulation(a)
		  //.force('charge', d3.forceManyBody().strength(s))
		  .force('x', d3.forceX(function(d){
			return map.latLngToLayerPoint(d.latLng).x}))
			.force('y', d3.forceY(function(d){
			return map.latLngToLayerPoint(d.latLng).y}))
		  .force('collision', d3.forceCollide().radius(function(d) {
		    return getRadius(d.data);
		  }))
		  .stop();

		  for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
		    	simulation.tick();
		  }

		  /*i = 50;
		  while(i-- > 0){
		  	simulation.tick();
		  }
		  /*.on('tick', ticked)*/
		  /*.on('end', function(){
		  	return Promise.resolve();
		  });*/

		/*function ticked() {
		  var u = d3.select('svg')
		    .selectAll('circle')
		    .data(a)

		  u.enter()
		    .append('circle')
		    .attr('r', function(d) {
		      return getRadius(d.data)
		    })
		    .merge(u)
		    .attr('cx', function(d) {
		      return d.x;
		    })
		    .attr('cy', function(d) {
		      return d.y;
		    })

		  u.exit().remove()
		}*/
	}

	function xyToLatLng(x,y) {

	  // calculate point in xy space
	  var pointXY = L.point(x, y);

	  // convert to lat/lng space
	  var pointlatlng = map.layerPointToLatLng(pointXY);
	  return pointlatlng;
	}

	function showData(data){
		data = data.data;
		var dataDiv = document.querySelector('.modal-content .data');
		dataDiv.innerHTML = '';
		for(var i in data){
			var p = document.createElement('p');
			p.innerText = i + ' : ' + data[i];
			dataDiv.append(p);
		}
	}

	function showTooltip(e,data){

		pauseAllWAAPI(document.querySelectorAll('.map-container circle'));

		if(!document.getElementById('hoverbox')){
			d3.select('body').append('div')
	        .classed('animated', true)
	        .classed('fadeInOpac', true)
	        .classed('toolM', true)
	        .attr('id', 'hoverbox');
	      // tooltip selection
	      var tooltip = d3.select('.toolM');

	      tooltip.append('div')
	      .classed('toolhead', true)
	      .append('div')
	      .classed('toolheadData', true)
	      .html(function(){
	        return '<p class="datePara"><span class="dateHead">Zone: </span><span class="lato">' + data.Zone + '</span></p>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
	      });

	      d3.select('.toolhead')
	      .append('div')
	      .classed('toolheadIcon', true)
	      .html(function(){
	        return '<i class="fas fa-tree"></i>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
	      });

	      tooltip.append('div')
	      .classed('sectionHead', true)
	      .html(function(){
	        return '<div class="sectionHeadingContain"><p class="sectionHeading">Attendance</p><i class="fas fa-map-marker-alt"></i></div><div class="separator"></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
	      });

	      tooltip.append('div')
	      .classed('attendanceValue', true)
	      .html(function(){
	        return '<div class="attendanceValues lato" id="present"><span class="attendanceHead">Present: </span><span>' + (parseInt(data['Present without Uniform']) + parseInt(data['Present'])) + '</span></div><div class="attendanceValues lato" id="absent"><span class="attendanceHead">Absent: </span><span>' + data['Valid Absent'] + '</span></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
	      });

	      var radius = 2 * getRadius(data);

	      var tooltipRect = tooltip.node().getBoundingClientRect();

	      var position = getPositionPoint(tooltipRect.width, tooltipRect.height,{
	      	x : d3.event.pageX,
	      	y : d3.event.pageY
	      }, {right : window.innerWidth, bottom : window.innerHeight});

	      tooltip.style('left', position.x + 'px');
	      tooltip.style('top', position.y + 'px');

		}else{
			var tooltip = d3.select('.toolM');

			var tooltipRect = tooltip.node().getBoundingClientRect();

			var position = getPositionPoint(tooltipRect.width, tooltipRect.height, {
				x : d3.event.pageX,
				y : d3.event.pageY
			}, {right : window.innerWidth, bottom : window.innerHeight});

			tooltip.style('left', position.x + 'px');
			tooltip.style('top', position.y + 'px');

		}
	}

	function moveTooltip(){
		var tooltip = d3.select('.toolM');

		if(!tooltip.node()){
			return;
		}

		var tooltipRect = tooltip.node().getBoundingClientRect();

		var position = getPositionPoint(tooltipRect.width, tooltipRect.height, {
			x : d3.event.pageX,
			y : d3.event.pageY
		}, {right : window.innerWidth, bottom : window.innerHeight});

		tooltip.style('left', position.x + 'px');
		tooltip.style('top', position.y + 'px');

	}

	function getPositionPoint(width, height, point, bounds){

		var position = {};

		if(point.x + width > bounds.right - 20){
			position.x = point.x - width - 20;
		}else{
			position.x = point.x + 20;
		}

		if(point.y + height < bounds.bottom - 20){
			position.y = point.y + 20;
		}else{
			position.y = point.y - height - 20;
		}

		if(position.x < 0){
			position.x = 10;
		}

		if(position.y < window.scrollY){
			position.y = window.scrollY + 10;
		}

	//	console.log(position);
		return position;
	}

	function getWeekString(week, year){
		var yearStart = new Date(year, 0,1);
		yearStart.setDate(yearStart.getDate() + (1 + 7 - yearStart.getDay()) % 7);
		var msFromStart = week * (24 * 60 * 60 * 1000 * 7);

		var currentWeek = new Date();
		currentWeek.setTime(yearStart.getTime() + msFromStart);
		var finalDay = new Date();
		finalDay.setTime(currentWeek.getTime() + (24 * 60 * 60 * 1000 * 6));

		return currentWeek.toDateString() + ' - ' + finalDay.toDateString();
	}


	//slider
	var sliderMin = 0;
	var sliderMax = 49;
	var sliderDivs = 49;
	var sliderArea = document.getElementsByClassName('slider-area')[0];
	var sliderTrack = document.getElementsByClassName('slider-track')[0];
	var progressSlider = document.getElementsByClassName('progress-slider')[0];
	var handle = document.getElementsByClassName('handle')[0];
	var handleContainer = document.getElementsByClassName('handle-container')[0];

	var sliderValue = 0;

	sliderArea.addEventListener('mousedown', handleSliderMouseDown);

	//sliderArea.addEventListener('mouseup', handleSliderMouseUp);

	function handleSliderMouseDown(e){
		e.preventDefault();
		e.stopPropagation();
		document.addEventListener('mouseup', handleSliderMouseUp);
	//	console.log('md');
		var clickPointWidth = e.clientX - this.getBoundingClientRect().left;
		updateSlider(clickPointWidth);
	//	console.log('md', 'handleSliderMouseDown');
		player.handleDayChange(sliderValue);
	}

	function handleSliderMouseUp(e){
	//	console.log('mu');
		e.preventDefault();
		e.stopPropagation();
	//	console.log('mu', 'handleSliderMouseUp');
		player.finishDayChange(sliderValue);
		document.removeEventListener('mouseup', handleSliderMouseUp);
	}

	handle.onmousedown = startDrag;
	handle.ontouchstart = startDrag;

	var transitionCSS = '';

	var sliderRect;
	function startDrag(e){
		e.preventDefault(e);
		e.stopPropagation();
		handle.style.backgroundColor = '#787878';
		//sliderArea.removeEventListener('click', handleSliderClick);
		document.addEventListener('mouseup', stopDrag);
		document.addEventListener('mousemove',dragHandle);
		document.addEventListener('touchend', stopDragTouch);
		document.addEventListener('touchmove',dragHandleTouch);
		sliderArea.removeEventListener('mouseup',handleSliderMouseUp);
		player.handleDayChange(sliderValue);
		sliderRect = sliderTrack.getBoundingClientRect();
		//console.log(player.state.name);
		//console.log('started day change');
		//console.log('md', 'startDrag');
	}

	function dragHandle(e){

		var mousePoint = e.clientX - sliderRect.left;

		if(e.clientX < sliderRect.left){
			mousePoint = 0;
		}else if(e.clientX > (sliderRect.left + sliderTrack.offsetWidth)){
			mousePoint = sliderTrack.offsetWidth;
		}else{
			mousePoint = e.clientX - sliderRect.left;
		}

		handleContainer.style.left = mousePoint  + 'px';
		progressSlider.style.width = mousePoint + 'px';
		//player.startDayChange(sliderValue);
		//console.log('md', 'dragHandle');
	}

	function dragHandleTouch(e){
		e.stopPropagation();
		e = e.changedTouches[e.changedTouches.length - 1];
		var mousePoint = e.clientX - sliderRect.left;

		if(e.clientX < sliderRect.left){
			mousePoint = 0;
		}else if(e.clientX > (sliderRect.left + sliderTrack.offsetWidth)){
			mousePoint = sliderTrack.offsetWidth;
		}else{
			mousePoint = e.clientX - sliderRect.left;
		}

		handleContainer.style.left = mousePoint  + 'px';
		progressSlider.style.width = mousePoint + 'px';
		//player.startDayChange(sliderValue);
		//console.log('md', 'dragHandle');
	}

	function stopDrag(e){

		e.preventDefault(e);
		//e.stopPropagation();
		handle.style.backgroundColor = '';

		var mousePoint = e.clientX - sliderRect.left;

		if(e.clientX < sliderRect.left){
			mousePoint = 0;
		}else if(e.clientX > (sliderRect.left + sliderTrack.offsetWidth)){
			mousePoint = sliderTrack.offsetWidth;
		}else{
			mousePoint = e.clientX - sliderRect.left;
		}

		updateSlider(mousePoint);
		document.removeEventListener('mouseup', stopDrag);
		document.removeEventListener('mousemove',dragHandle);
		document.removeEventListener('touchend', stopDragTouch);
		document.removeEventListener('touchmove',dragHandleTouch);
		sliderArea.addEventListener('mouseup', handleSliderMouseUp);
		//console.log('stopped');
		//console.log('mu', 'stopDrag');
		player.finishDayChange(sliderValue);
		//sliderArea.addEventListener('mousedown', handleSliderClick);
	}

	function stopDragTouch(e){

		e = e || window.event;

		e.preventDefault(e);
		e.stopPropagation();
		e = e.changedTouches[e.changedTouches.length - 1];
		//e.stopPropagation();
		handle.style.backgroundColor = '';

		var mousePoint = e.clientX - sliderRect.left;

		if(e.clientX < sliderRect.left){
			mousePoint = 0;
		}else if(e.clientX > (sliderRect.left + sliderTrack.offsetWidth)){
			mousePoint = sliderTrack.offsetWidth;
		}else{
			mousePoint = e.clientX - sliderRect.left;
		}

		updateSlider(mousePoint);
		document.removeEventListener('mouseup', stopDrag);
		document.removeEventListener('mousemove',dragHandle);
		document.removeEventListener('touchend', stopDragTouch);
		document.removeEventListener('touchmove',dragHandleTouch);
		sliderArea.addEventListener('mouseup', handleSliderMouseUp);
		//console.log('stopped');
		//console.log('mu', 'stopDrag');
		player.finishDayChange(sliderValue);
		//sliderArea.addEventListener('mousedown', handleSliderClick);
	}

	function getClosestEvenlySpacedWidth(divs, width){
		var divLen = sliderTrack.offsetWidth / divs;

		var q = Math.round(width/divLen);

		return q * divLen;
	}

	function getSliderValue(width){
		var range = sliderMax - sliderMin;
		return Math.round((width/sliderTrack.offsetWidth) * range);
	}

	function updateSlider(clickPointWidth){
		var closestValue = getClosestEvenlySpacedWidth(sliderDivs, clickPointWidth);
		sliderValue = getSliderValue(closestValue);
		//console.log(sliderValue);
		progressSlider.style.width = closestValue + 'px';
		handleContainer.style.left = closestValue + 'px';
	}

	function changeSliderValue(newVal){
		sliderValue = newVal;
		var range = sliderMax - sliderMin;
		var newWidth = newVal/range * sliderTrack.offsetWidth;
		progressSlider.style.width = newWidth + 'px';
		handleContainer.style.left = newWidth + 'px';
	}

	//play pause buttons
	var pauseButton = document.querySelector('.pause-control #pause');
	var playButton = document.querySelector('.pause-control #play');

	function togglePlayPause(showButton, action){
		player[action]();
		this.style.display = 'none';
		showButton.style.display = 'inline-block';
	}

	pauseButton.onclick = togglePlayPause.bind(pauseButton, playButton, 'pause');
	playButton.onclick = togglePlayPause.bind(playButton, pauseButton, 'play');

	pauseButton.style.display = 'inline-block';

	function waitForAllWAAPI(getAnimationProps, elements, clear){

		if(!Array.isArray(elements)){
			elements = [].slice.call(elements);
		}

		if(elements.length === 0){
			return Promise.resolve();
		}

		var count = 0;
		var firstFrame;
		elements.forEach(function(e){
			count++;
			var props = getAnimationProps.call(e, e.__data__);
			firstFrame = props.keyframes[0];
			e._animation = e.animate(props.keyframes, props.options);
		});

		return new Promise(function(resolve){

			elements.forEach(function(e){
				e._animation.onfinish = function(){
					--count;

					if(clear){
						var cStyle = window.getComputedStyle(e);
						for(var i in firstFrame){
							e.style[i] = cStyle[i];
						}
						e._animation.cancel();
					}

					if(count === 0){
						resolve();
					}
				};
			});
		});
	}

	function pauseAllWAAPI(elements){

		if(!Array.isArray(elements)){
			elements = [].slice.call(elements);
		}

		elements.forEach(function(e){
			if(e._animation.playState === 'running'){
				e._animation.pause();
			}
		});
	}

	function resumeAllWAAPI(elements){

		if(!Array.isArray(elements)){
			elements = [].slice.call(elements);
		}

		elements.forEach(function(e){
			if(e._animation.playState === 'paused'){
				e._animation.play();
			}
		});
	}

	function cancelAllWAAPI(elements){

		if(!Array.isArray(elements)){
			elements = [].slice.call(elements);
		}

		elements.forEach(function(e){
			if(!(e._animation.playState === 'finished')){
				e._animation.cancel();
			}
		});
	}

})();
