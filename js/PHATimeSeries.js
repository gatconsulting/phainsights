
  // global variable to track selected type/ head
  var USER_HEAD = null;

  // defining the margins and the dimensions of chart
  const margin = {top: 20, right: 60, bottom: 60, left: 60};

  const svg_height = 350;
  const svg_width = 950;
  // computing width and height of actual chart
  const width = svg_width - margin.left - margin.right;
  const height = svg_height - margin.top - margin.bottom;

  // time format for month and year
  const parseDate = d3.timeParse('%d-%b-%y');
  // used in axis ticks
  const formatMonth = d3.timeFormat("%b-%y");

  function processDataFromDash(dataFromDash){
    // preprocssing the attendance data
    // modify selected fields
    dataFromDash.forEach(d => {
      // parse dates to date object
      d.DateP = parseDate(d.Date);
      // getting fields/ attributes that are numeric
      let keysWODate = Object.keys(d).filter(entry => !(["Date", "DateP", "Zone"].includes(entry)));
      keysWODate.forEach(key => {
        d[key] = +d[key]
      })
      // calculating new fields (Valid surveys, total present and percentages/ rates)
      d.validSurveys = d.Surveyed - d.Awaiting;
      d.presentTotal = d["Present without Uniform"] + d["Present"];
      d["Other comment"] = d["Other"] + d["Other Duty"] + d["Driver"];
      d["Dormant"] = d["Left Job"] + d["Retired"] + d["Death"];
      d["Other shifts and Transfers"] = d["Night Shift"] + d["Evening"] + d["Transfer"] ;
      d.presentPercent = (d.presentTotal/ d.validSurveys) * 100;
      d.absentPercent = (d['Valid Absent']/ d.validSurveys) * 100;
      d["otherPercent"] = (d["Other comment"]/ d.validSurveys) * 100;
      d["dormantPercent"] = (d["Dormant"]/ d.validSurveys) * 100;
      d["otherShiftsPercent"] = (d["Other shifts and Transfers"]/ d.validSurveys) * 100;
      d["leavePercent"] = (d["Leave"]/ d.validSurveys) * 100;
      d["CNICPercent"] = (d["CNIC Mismatch"]/ d.validSurveys) * 100;
    })

    //get rid of any entries with 0 valid surveys
    //sorting by dates
    let dataFromDashFilt = dataFromDash.filter(d => d.validSurveys != 0)
                                          .sort(function(a,b){
                                            return a.DateP - b.DateP;
                                          });

    return dataFromDashFilt;
  }

  // phaMasterData is gotten by preprocessing the data from Dashboard
  let phaMasterData = processDataFromDash(phaDataDash);


  // generate data for areaChart
  function makeAreaData(data){
    return data.map(function(d){
      return {
        "Date" : d["Date"],
        "DateP" : d["DateP"],
        "Other" : d["otherPercent"],
        "Dormant" : d["dormantPercent"],
        "Other Shifts" : d["otherShiftsPercent"],
        "Leave" : d["leavePercent"],
        "CNIC Mismatch" : d["CNICPercent"]
      }
    })
  }

  // define layouts, scales and axes
  var stack = d3.stack();

  // defining x and y scales
  var x = d3.scaleTime()
            .range([0, width]);

  var y = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);

  // defining yScale for the surveys
  var ySurvey = d3.scaleLinear()
                  .range([height, 0]);

  // defining the axes (you call this axis function later within a group selection)
  var xAxis = d3.axisBottom()
               .scale(x)
               .tickFormat(formatMonth);

  var yAxisLeft = d3.axisLeft()
                    .scale(y)

  var yAxisRight = d3.axisRight()
                    .scale(ySurvey)
                    .ticks(6);

  // defining area charts
  var yArea = d3.scaleLinear()
                .domain([0, 100])
                .range([height, 0])

  var area = d3.area()
              .x(function(d, i) { return x(d.data.DateP); })
              .y0(function(d) { return yArea(d[0]); })
              .y1(function(d) { return yArea(d[1]); })
              .curve(d3.curveStep)

  // function to return a line function
  var lineLayout = function(feature){
    var line = d3.line()
               .x(d => x(d.DateP))
               .y(d => y(d[feature]))
               .curve(d3.curveStep);

    return line;
  }

  // setting domain for the time scale
  x.domain(d3.extent(phaMasterData, d => d.DateP));

  // defining barpadding and width for surveys bar chart
  var barPadding = 0
  var barWidth = x(parseDate("31-May-17")) - x(parseDate("30-May-17")) - barPadding;

  // defining voronoi for time units
  var voronoi = d3.voronoi()
                .x(d => x(d.DateP))
                .y(d => y(0))
                .extent([[0, 0], [width + 10, height]])

  function redrawPolygon(polygon) {
    polygon.attr("d", function(d) { return d ? "M" + d.join("L") + "Z" : null; });
    polygon.style('fill-opacity', 0)
          .style('stroke', 'black')
          .style('stroke-width', 0.5)
          .style('stroke-opacity', 0.0)
  }

  // function to initialize chart
  // function takes in data, zone and a date range and gives charts
  function makeChart(phaData, zone, dateRange) {
      // remove all the graphical elements in the two divs holding charts
      d3.select("body div.linechart-contain").selectAll('*').remove();
      d3.select("body div.areachart-contain").selectAll('*').remove();

      // get the data within the daterange and a selected zone
      var phaDataTF = phaData.filter(d => d.DateP > parseDate(dateRange[0]) & d.DateP <= parseDate(dateRange[1]));
      var pha = phaDataTF.filter(d => d.Zone == zone);

      // get the updated domain from data subsetted on the basis of time
      x.domain(d3.extent(phaDataTF, d => d.DateP));

      // update the surveys scale's domain based on the subsetted data
      var max_srveys = d3.max(pha, d => d.validSurveys);
      ySurvey.domain([0, max_srveys])

      // starting to append elements within the html
      var svg = d3.select('.linechart-contain')
                  .append('svg')
                  .classed('lineChartSVG', true)
                  .attr("preserveAspectRatio", "xMinYMin meet")
                  .attr("viewBox", "0 0 " + svg_width + " " + svg_height);

      // defining the group that contains the line chart
      var chart_g = svg.append('g')
                      .attr('transform', 'translate('+ margin.left + ',' + margin.top +')')
                      .classed("chart_group", true);


      // add rectangles to the background first
      // to show total activity/ surveys
      chart_g.selectAll('rect')
              .data(pha)
              .enter()
              .append('rect')
              .attr('x', d => x(d.DateP))
              .attr('y', d => ySurvey(d.validSurveys))
              .attr('width', barWidth )
              .attr('height', d => height - ySurvey(d.validSurveys))
              .style('opacity', 0.10)
              .style('fill', 'grey')
              .attr('class', d => "T" + d.Date)
              .attr('id', d => d.Date);

      // append axes on the line time series chart
      chart_g.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + height + ')')
          .call(xAxis)

      chart_g.append('g')
          .attr('class', 'y axis left')
          .call(yAxisLeft)
          .append("text")
          .attr('class', 'y axis left label')
          .text("Present/ Absent Percent")
          .attr('transform', 'translate(-50,' + height/2 + ') rotate(270)');

      chart_g.append('g')
          .attr('class', 'y axis right')
          .attr('transform', 'translate(' + width + ', 0)')
          .call(yAxisRight)
          .append("text")
          .attr('class', 'y axis right label')
          .text("Valid Surveys")
          .attr('transform', 'translate(50,' + height/2 + ') rotate(270)');

      //appending circles for each data point in teh time series
      chart_g.selectAll('.timeSCirc')
              .data(pha)
              .enter()
              .append('circle')
              .attr('class', d => 'timeSCirc T' + d.Date)
              .attr('cx', d => x(d.DateP))
              .attr('cy', d => y(d.presentPercent))
              .attr('r', 0)
              .style('fill', 'grey')
              .style('opacity', 1);

      // appending trendlines (present)
      chart_g.selectAll('.trendline')
              .data([pha])
              .enter()
              .append('path')
              .attr('d', lineLayout('presentPercent'))
              .style('fill', 'none')
              .style('stroke', '#448AFF')
              .style('stroke-width', 1.8)
              .style('stroke-opacity', 0.75)
              .classed('trendline', true);
      // appending trendlines (absent)
      chart_g.selectAll('.trendlineAbs')
              .data([pha])
              .enter()
              .append('path')
              .attr('d', lineLayout('absentPercent'))
              .style('fill', 'none')
              .style('stroke', 'red')
              .style('stroke-width', 1.8)
              .style('stroke-opacity', 0.35)
              .classed('trendlineAbs', true);

      // append voronoi cells for interaction
      var polygon = chart_g.append("g")
                          .attr("class", "polygons")
                          .selectAll("path")
                          .data(voronoi.polygons(pha))
                          .enter().append("path")
                          .attr("class", d => "T" + d.data.Date)
                          .classed("voronoiPath", true)
                          .call(redrawPolygon);

      // get area data using the function defined earlier
      var phaAreaData = makeAreaData(pha);

      // get a list of total comments and get the maximum
      var totalComm = phaAreaData.map(d => d["Other"] + d["Dormant"] + d["Other Shifts"] + d["Leave"] + d["CNIC Mismatch"])
      var maxComm = d3.max(totalComm);

      // from the first data entry get the keys of the area layers
      // assign eyes to the area layout
      var areaKeys = Object.keys(phaAreaData[0]).slice(2);
      stack.keys(areaKeys);

      // area chart shit
      var svgArea = d3.select('body')
                      .select('div.areachart-contain')
                      .append('svg')
                      .classed('areaChartSVG', true)
                      .attr("preserveAspectRatio", "xMinYMin meet")
                      .attr("viewBox", "0 0 " + svg_width + " " + svg_height)


      // defining the group that contains the area chart
      var chart_gArea = svgArea.append('g')
                 .attr('transform', 'translate('+ margin.left + ',' + margin.top +')')
                 .classed("chart_groupArea", true);

      // append zone attribute to identify the selected or past selected zone
      chart_gArea.attr("zone", zone);


      var layer = chart_gArea.selectAll(".layer")
                          .data(stack(phaAreaData))
                          .enter().append("g")
                          .attr("class", "layer");

      // color scale for coloring comment types
      var z = d3.scaleOrdinal(d3.schemeCategory10);

      // y axis for area chart
      var yAxisLeftArea = d3.axisLeft()
                            .scale(yArea)

      // append axes on area chart
      chart_gArea.append('g')
          .attr('class', 'x axis')
          .attr('transform', 'translate(0,' + height + ')')
          .call(xAxis)

      // groups to hold area chart paths
      chart_gArea.append('g')
          .attr('class', 'y axis')
          .call(yAxisLeftArea)
          .append("text")
          .attr('class', 'y axis left label')
          .text("Comments Percent")
          .attr('transform', 'translate(-50,' + height/2 + ') rotate(270)');

      // add path layers for all keys (comments)
      layer.append("path")
          .attr("class", d => "area " + d.key)
          .attr("id", d => d.key)
          .style("fill", function(d) { return z(d.key); })
          .style("fill-opacity", 0.8)
          .attr("d", area);

      // event listener for area clicks
      svgArea.selectAll(".area").on("click", function(d,i) {
         if (USER_HEAD === null) {
             USER_HEAD = d3.select(this).attr("id");

         } else {
             USER_HEAD = null;
         }
         // updates the area chart and bubbles accordingly
         var zone = d3.select('.chart_groupArea').attr('zone');
         update(zone);
      });

      // mouseover event listener for paths
      svgArea.selectAll('.area').on('mouseover', function(d){
        svgArea.select('.x.axis')
          .append('text')
          .classed('head_text', true)
          .text(d.key)
          .attr('transform', 'translate('+ width/2 + ', 40)')
          .style('text-anchor', 'middle')
          .style('font-family', 'sans-serif')
          .style('font-size', '13px')
          .transition("labelFade")
          .duration(250)
          .style('fill', 'black');
      })

      // mouseout event listener for paths
      svgArea.selectAll('.layer').on('mouseout', function(d){
        svgArea.select('.x.axis').select('.head_text').remove()
      })

      // function that activates mouseover/ mouseout functionality for line chart
      activateMO();

      // make legend function
      function makeLegend(){
        var categs = stack(phaAreaData).map(d => d.key)

        var ordinal = d3.scaleOrdinal(d3.schemeCategory10)
                        .domain(categs)

        svgArea.append("g")
              .attr("class", "legendOrdinal")
              .attr("transform", "translate(800,20)");

        var legendOrdinal = d3.legendColor()
          .shapePadding(1)
          .shapeWidth(15)
          .shapeHeight(10)
          .scale(ordinal);

        svgArea.select(".legendOrdinal")
          .call(legendOrdinal);
      }

      // call makeLegend function
      makeLegend()

  }

  function areaAddZeros(wide, USER_HEAD, timeParams){
    // USER_HEAD is the field to retain and timeParams are all the remianing feature names that need to be saved
    var wide_show = wide.map(function(d){
      d_copy = Object.assign({}, d)
      for (i in d3.keys(d_copy)){
        if (!timeParams.includes(d3.keys(d_copy)[i]) && d3.keys(d_copy)[i] != USER_HEAD){
          d_copy[d3.keys(d_copy)[i]] = 0;
        }
      }
      return d_copy;
    })
    return wide_show;
  }

  function areaAddZerosStack(stackData, USER_HEAD){
    let listKeys = stackData.map((d, i) => d.key);
    let idx = listKeys.indexOf(USER_HEAD);
    return stackData.map(d => {
      if (d.key == USER_HEAD){
      	return d.map(s => [0, s[1] - s[0]])
      }
      else {
        if (i < idx){
          return d.map(s => [0, 0]);
        }
        else {
          return d.map(s => [s[0], s[0]]);
        }
      }
    })
    d.key = d.key;
    d.index = d.index;
  }



  function update(zone){
    // get xDom from current scale
    var xDom = x.domain()
    // get the data within teh same time window
    phaMasterDataTimeFilt = phaMasterData.filter(d => d.DateP >= xDom[0] & d.DateP <= xDom[1]);
    // filter data for teh selected zone
    var pha = phaMasterDataTimeFilt.filter(d => d.Zone == zone);

    var phaAreaData = makeAreaData(pha);
    // empty array for updated data. Will add zeros to the heads not selected
    var upd_data = [];

    // USER_HEAD is null by default, takes the value of comment type when area layer clicked

    if (USER_HEAD != null){
      var updData = areaAddZeros(phaAreaData, USER_HEAD, ["Date", "DateP"]);
      // stack the updated data
      updDataSt = stack(updData);
    }
    else {
      updDataSt = stack(phaAreaData);
    }

    //transition in the area charts
    // data update on paths/ areas
    d3.selectAll(".area")
      .data(updDataSt);

    d3.selectAll(".area")
      .transition()
      .duration(1000)
      .attr("d", area)
  }

  // update the y axis, when the y axis domain/ range is updated, call this
  function update_y_axis(delay_time){
    // update the axis on every update()
    d3.select('.areaChartSVG').select(".y.axis")
      .transition()
      .delay(delay_time)
      .duration(1000)
      .call(yAxisLeftArea);
  }

  function updateCharts(zone){
    USER_HEAD = null;
    var xDom = x.domain()

    phaMasterDataTimeFilt = phaMasterData.filter(d => d.DateP >= xDom[0] & d.DateP <= xDom[1]);
    var phaData = phaMasterDataTimeFilt.filter(d => d.Zone == zone);

    // recompute max surveys
    max_srveys = d3.max(phaData, d => d.validSurveys);

    // and update the y survey axis domain
    ySurvey.domain([0, max_srveys]);

    // select and update the y axis
    d3.select('.lineChartSVG').select(".y.axis.right")
      .transition()
      .call(yAxisRight);

    var chart_g = d3.select(".chart_group")

    // apply transition to the trendlines (both present and absent)
    chart_g.selectAll('.trendline')
            .data([phaData])
            .transition()
            .duration(250)
            .attr('d', lineLayout("presentPercent"))

    chart_g.selectAll('.trendlineAbs')
            .data([phaData])
            .transition()
            .duration(250)
            .attr('d', lineLayout("absentPercent"))

    // bind new data to rects
    var rectDatBind = chart_g.selectAll("rect")
                            .data(phaData, d => d.Date);

    // build new rects in enter()
    rectDatBind.enter()
              .append("rect")
              .attr('x', d => x(d.DateP))
              .attr('y', d => ySurvey(d.validSurveys))
              .style('fill', 'grey')
              .transition()
              .attr('width', barWidth )
              .attr('height', d => height - ySurvey(d.validSurveys))
              .style('opacity', 0.10)
              .attr('class', d => "T" + d.Date)
              .attr('id', d => d.Date);

    // update the update selection
    rectDatBind.transition()
              //.attr('width', barWidth )
              .attr('y', d => ySurvey(d.validSurveys))
              .attr('height', d => height - ySurvey(d.validSurveys))

    // remove the exit selection
    rectDatBind.exit().remove();

    // enter, update and exit on circles
    var chartCircles = chart_g.selectAll('.timeSCirc')
                              .data(phaData, d => d.Date)
                              .attr('cx', d => x(d.DateP))
                              .attr('cy', d => y(d.presentPercent))

    chartCircles.enter().append('circle')
                        .attr('class', d => 'timeSCirc T' + d.Date)
                        .attr('cx', d => x(d.DateP))
                        .attr('cy', d => y(d.presentPercent))
                        .attr('r', 0)
                        .style('fill', 'grey')
                        .style('opacity', 1);

    chartCircles.exit().remove();

    // remove old polygons/ voronoi
    d3.select("g.polygons").remove();

    // draw new voronoi based on new data
    polygon = chart_g.append("g")
                      .attr("class", "polygons")
                      .selectAll("path")
                      .data(voronoi.polygons(phaData))
                      .enter().append("path")
                      .attr("class", d => "T" + d.data.Date)
                      .classed("voronoiPath", true)
                      .call(redrawPolygon);

    // activate mouse based interaction
    activateMO();

    // make new area data
    var phaDataArea = makeAreaData(phaData);

    d3.select("g.chart_groupArea").attr("zone", zone);

    d3.selectAll(".area")
      .data(stack(phaDataArea));

    d3.selectAll(".area")
      .transition()
      .duration(250)
      .attr("d", area)
  }

  // activate mouse based interaction
  activateMO();


  function activateMO(){
    d3.selectAll(".voronoiPath").on("mouseover", function(d, i){
      // class_name is the date, get the date
      var class_name = d3.select(this).attr("class").replace(" voronoiPath", "");
      // get data from one of teh circles using gotten date
      var datum = d3.select(".timeSCirc." + class_name).data()[0];

      //make circle and rect appear different
      d3.select(".timeSCirc." + class_name)
        .attr('r', 4)
        .append("title")
        .text(d => d.Date);

      d3.select("rect." + class_name)
        .attr('fill', "#448AFF")
        .style('opacity', 0.8);

      // append tooltip
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
        return '<p class="datePara"><span class="dateHead">Date: </span><span class="lato">' + datum.Date + '</span></p><span class="dateHead">Valid Surveys: </span><span class="lato">' + datum.validSurveys + '</span>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      })

      d3.select('.toolhead')
      .append('div')
      .classed('toolheadIcon', true)
      .html(function(){
        return '<i class="fas fa-tree"></i>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      })

      tooltip.append('div')
      .classed('sectionHead', true)
      .html(function(){
        return '<div class="sectionHeadingContain"><p class="sectionHeading">Attendance</p><i class="fas fa-map-marker-alt"></i></div><div class="separator"></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      })

      tooltip.append('div')
      .classed('attendanceValue', true)
      .html(function(){
        return '<div class="attendanceValues lato" id="present"><span class="attendanceHead">Present: </span><span>' + datum.presentPercent.toPrecision(4) + ' %</span></div><div class="attendanceValues lato" id="absent"><span class="attendanceHead">Absent: </span><span>' + datum.absentPercent.toPrecision(4) + ' %</span></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      })

      tooltip.append('div')
      .classed('sectionHead', true)
      .html(function(){
        return '<div class="sectionHeadingContain"><p class="sectionHeading">Comments</p><i class="fas fa-comments"></i></div><div class="separator"></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      })

      tooltip.append('div')
      .classed('attendanceValue', true)
      .html(function(d){
        return '<div class="attendanceValues lato" id="dormant"><span class="attendanceHead">Dormant: </span><span>' + datum.dormantPercent.toPrecision(4) + ' %</span></div><div class="attendanceValues lato" id="absent"><span class="attendanceHead">Leave: </span><span>' + datum.leavePercent.toPrecision(4) + ' %</span></div><div class="attendanceValues lato" id="otherShift"><span class="attendanceHead">Other Shifts: </span><span>' + datum.otherShiftsPercent.toPrecision(4) + ' %</span></div><div class="attendanceValues lato" id="other"><span class="attendanceHead">Other: </span><span>' + datum.otherPercent.toPrecision(4) + '%</span></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      })


      tooltip.style('top', d3.event.pageY - document.getElementById('hoverbox').getBoundingClientRect().height/2 + "px");
      if (d3.event.pageX < window.innerWidth/2) {
        tooltip.style('left', d3.event.pageX + 14 + "px");
      }
      else {
        tooltip.style('left', d3.event.pageX - 260 + "px");
      }
    })

    d3.selectAll(".voronoiPath").on("mouseout", function(d, i){
      // class name contains date, get the date
      var class_name = d3.select(this).attr("class").replace(" voronoiPath", "");

      // select the relevant circles and rects, change their appearance
      d3.select(".timeSCirc." + class_name)
        .attr('r', 0);

      d3.select("rect." + class_name)
        .attr('fill', "grey")
        .style('opacity', 0.10);

      // remove tooltip
      d3.selectAll('.tool').remove()
    })
  }
