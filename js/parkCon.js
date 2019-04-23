function processParkConData(parkConSum, type){
  // date format to parse
  var parseDate = d3.timeParse('%d-%b-%y')

  // parsing date and some preprocessing
  parkConSum.forEach(d => {
    d.DateP = parseDate(d.Date);
    d.n_locations = +d.n_locations;
    d.mean_score = +d.mean_score;
  })

  // defining chart dimensions wrt dates
  parkConSum.sort(function(a,b){
    return a.DateP - b.DateP;
  })

  // filtering the zones depending on type and and neglecting all surveys before Oct 2017
  parkConSum = parkConSum.filter(d => (type == "Other") ? d.Zone == "Other" : d.Zone != "Other");
  parkConSum = parkConSum.filter(d => d.DateP > parseDate("1-Oct-17"));

  return parkConSum;
}


function drawParkConChart(data, container){
  // defining dimensions
  var svg_width = 900;
  var svg_height = 400;
  var margins = {
    top: 50,
    bottom: 40,
    right: 110,
    left: 70
  }

  // recalculating height and width
  var height = svg_height - margins.top - margins.bottom;
  var width = svg_width - margins.left - margins.right;

  // chart container
  var svg_g = d3.select("body")
                  .select(container)
                  .append("svg")
                  .attr("preserveAspectRatio", "xMinYMin meet")
                  .attr("viewBox", "0 0 " + svg_width + " " + svg_height)
                  .style('background', '#EEEEEE')
                  .append("g")
                  .attr("class", "chartGroup")
                  .attr("transform", "translate("+ margins.left + ", "+ margins.top +")");

  // get all the zones sorted alpahapetically
  var zones =  data.map(d => d.ZoneAct)
                  .sort(function(a, b){
                    if(a < b) return -1;
                    else if(a > b) return 1;
                    else return 0;
                  });

  // define scales and axes
  var x = d3.scaleTime()
            .domain(d3.extent(data, d => d.DateP))
            .range([0, width]);

  var y = d3.scaleOrdinal()
            //.domain(data.map(d => d.Zone))
            .domain(zones)
  // categorical scale on the y axis
  // get an interval and specify a range using the interval
  var interval = height/ y.domain().length;
  y.range(d3.range(0, height + 1, interval))

  // format of the month
  const formatMonth = d3.timeFormat("%b-%y");

  // defining axes
  var xAxis = d3.axisBottom()
               .scale(x)
               .tickFormat(formatMonth);


  var yAxisLeft = d3.axisLeft()
               .scale(y)

  var yGridlines = d3.axisLeft()
                      .scale(y)
                      .tickSize(-width)
                      .tickFormat("")

  // defining radius scale and color scale to denote activity and condition
  var radScale = d3.scaleSqrt()
                  .domain([0, d3.max(data, d => d.n_locations)])
                  .range([0, 20]);

  // exponent scale due to negatively skewed distribution
  var scaleColor =  d3.scalePow()
                      .exponent(Math.E)
                      .domain([0, 100])
                      .range(["Red", "Blue"]);

  // append grid lines
  svg_g.append('g')
      .attr('class', 'y axis grid parkCon')
      .call(yGridlines)

  // draw circles
  svg_g.append('g')
      .attr('class', 'condCircles')
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr('cx', d => x(d.DateP))
      .attr('cy', d => y(d.ZoneAct))
      .style('fill', d => scaleColor(d.mean_score))
      .style('fill-opacity', 0.5)
      .attr('r', 0)
      .transition('startCircTrans')
      .duration(750)
      .attr('r', d => radScale(d.n_locations))
      .attr('class', d => d.ZoneAct + " T" + d.Date);


  // draw the x and y axis
  svg_g.append('g')
      .attr('class', 'x axis parkCon')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis)

  svg_g.append('g')
      .attr('class', 'y axis left parkCon')
      .style('transform', 'translateX(-44px)')
      .call(yAxisLeft)

  // define voronoi for interactivity
  var voronoi = d3.voronoi()
                .x(d => x(d.DateP))
                .y(d => y(d.ZoneAct))
                .extent([[0, -30], [width, height]])

  // draw voronoi polygons
  var polygon = svg_g.append("g")
                    .attr("class", "polygons")
                    .selectAll("path")
                    .data(voronoi.polygons(data))
                    .enter().append("path")
                    .attr("date", d => "T" + d.data.Date)
                    .attr("zone", d => d.data.ZoneAct)
                    .classed("voronoiPath", true)
                    .call(redrawPolygon);

  function redrawPolygon(polygon) {
    polygon.attr("d", function(d) { return d ? "M" + d.join("L") + "Z" : null; });
    polygon.style('fill-opacity', 0)
          .style('stroke', 'black')
          .style('stroke-width', 0.5)
          .style('stroke-opacity', 0.0)
  }

  // Transition on interactivity
  var radTranScale = 1.25;
  var radTranDur = 750;
  const easeFun = d3.easeElastic;
  // mouseover and mouseout interaction
  d3.selectAll(".voronoiPath").on("mouseover", function(d, i){
    // select voronoi
    let voroPathSel = d3.select(this)
    let selData = voroPathSel.data()[0]
    // select zone and date (identifier of a circle)
    let zone = voroPathSel.attr('zone');
    let date = voroPathSel.attr('date');

    // select the circle and change its appearance
    let selCircle = d3.select('circle.' + zone+ '.' + date);
    let selCircleR = selCircle.attr('r')
    selCircle.style('stroke', 'black')
              .style('stroke-width', 1 + (1 * selCircleR/ 20))
              .transition('MoTrans')
              .duration(radTranDur)
              .ease(easeFun)
              .attr('r', selCircleR * radTranScale);

    // add tooltip
    d3.select('body').append('div')
      .classed('animated', true)
      .classed('fadeInOpac', true)
      .classed('tool', true)
      .attr('id', 'hoverbox')
    // tooltip selection
    var tooltip = d3.select('.tool');

    tooltip.append('div')
    .classed('toolhead', true)
    .append('div')
    .classed('toolheadData', true)
    .html(function(){
      return '<p class="datePara"><span class="dateHead">Date: </span><span class="lato">' + date + '</span></p><span class="dateHead">Zone: </span><span class="lato">' + zone + '</span>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
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
      return '<div class="sectionHeadingContain"><p class="sectionHeading">Park Condition</p><i class="fab fa-pagelines"></i></div><div class="separator"></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
    });

    tooltip.append('div')
    .classed('attendanceValue', true)
    .html(function(){
      return '<div class="attendanceValues lato" id="present"><span class="attendanceHead">Locations Surveyed: </span><span>' + selData.data.n_locations + '</span></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
    });

    tooltip.append('div')
    .classed('attendanceValue', true)
    .html(function(){
      return '<div style="margin-bottom: 15px" class="attendanceValues lato" id="present"><span class="attendanceHead">Condition Score: </span><span>' + selData.data.mean_score.toPrecision(4) + ' %</span></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
    });

    tooltip.style('top', d3.event.pageY - document.getElementById('hoverbox').getBoundingClientRect().height/2 + "px");
    if (d3.event.pageX < window.innerWidth/2) {
      tooltip.style('left', d3.event.pageX + 14 + "px");
    }
    else {
      tooltip.style('left', d3.event.pageX - 260 + "px");
    }

  });

  d3.selectAll(".voronoiPath").on("mouseout", function(d, i){
    // select voronoi
    let voroPathSel = d3.select(this)
    let zone = voroPathSel.attr('zone')
    let date = voroPathSel.attr('date')
    // select teh circle with gotten data and zone, change appearance as required
    let selCircle = d3.select('circle.' + zone+ '.' + date);
    let selCircleR = selCircle.attr('r')
    selCircle.style('stroke', 'none')
            .transition('MoTrans')
            .duration(radTranDur/2)
            .ease(easeFun)
            .attr('r', selCircleR / radTranScale);

    // remove tooltip
    d3.selectAll('.tool').remove();

  })

  function makeParkConLegend() {
    // declarative code to make legends, need to improve this
    var maxDom = Math.round(d3.max(radScale.domain()));
    var minDom = Math.round(d3.min(radScale.domain()));
    var interval = Math.floor((maxDom - minDom)/3);


    var radScaleLegendDom = d3.range(minDom, maxDom, interval)

    var radScaleLegend = d3.scaleOrdinal()
                          .domain(radScaleLegendDom)

    var radScaleLegendRan = radScaleLegendDom.map(function (d) {
      return radScale(d);
    });

    radScaleLegend.range(radScaleLegendRan);

    var svg = d3.select(container)
                .select("svg");

    svg.append("g")
      .attr("class", "legendSize parkCon")
      .attr("transform", "translate(845, 65)");

    svg.append("text")
      .attr('class', 'legendTitle')
      .attr('x', 825)
      .attr('y', 50)
      .text("Locations")
      .style('font-size', '12px')
      .style('font-family', 'Montserrat')
      //.style('transform', 'translateX(-5px)')

    var legendSize = d3.legendSize()
                      .scale(radScaleLegend)
                      .shape('circle')
                      .shapePadding(10)
                      .labelOffset(5);

    svg.select(".legendSize")
      .call(legendSize);

    var legendGrad = svg.append("g").attr('class', 'colorLegend parkCon')
                      .attr("transform", "translate(840 ,230)")
                      .append("defs").append("svg:linearGradient")
                      .attr("id", "gradient").attr("x1", "100%")
                      .attr("y1", "0%").attr("x2", "100%")
                      .attr("y2", "100%")
                      .attr("spreadMethod", "pad");

  	var scaleColor =  d3.scalePow()
  											.exponent(Math.E)
  											.domain([100, 0])
  											.range(["Blue", "Red"]);

    for (i = 0; i <= 100; i++) {
  		percentAmount = i + "%";
  		legendGrad.append("stop").attr("offset", percentAmount).attr("stop-color", scaleColor(i)).attr("stop-opacity", 0.5);
  	}

  	svg.append("rect").attr("width", 10).attr("height", 110).style("fill", "url(#gradient)").attr("transform", "translate(840,230)");

  	var y = d3.scaleLinear().range([110, 0]).domain([100, 0]);
  	var yAxis = d3.axisRight().scale(y).ticks(1);

  	svg.select('g.colorLegend').append("g").attr("class", "y axis parkCon").attr("transform", "translate(5,0)").call(yAxis).append("text").attr("transform", "rotate(-90)").attr("y", 30).attr("dy", ".71em").style("text-anchor", "end").text("axis title");

    svg.append("text")
      .attr('class', 'legendTitle')
      .attr('x', 825)
      .attr('y', 210)
      .text("Score")
      .style('font-size', '12px')
      .style('font-family', 'Montserrat')
  }
  // draw legends
  makeParkConLegend()
}

var parkConSumMain = processParkConData(parkConSum);
drawParkConChart(parkConSumMain, ".main_contain");

var parkConSumOther = processParkConData(parkConSum, "Other");
drawParkConChart(parkConSumOther, ".other_contain");
