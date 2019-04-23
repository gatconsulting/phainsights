// transform data function before putting it into drawCalendar function
function transformData(data, enumName, action, shift){
  var surveySumFilt
  // filter based on zone
  if (shift != "All"){
    surveySumFilt = data.filter(d => (d.full_name == enumName  & d.action == action & d.Shift == shift ))
  }
  else {
    surveySumFilt = data.filter(d => (d.full_name == enumName  & d.action == action));
  }
  // transform teh data
  var dateCount = surveySumFilt.map(d => {
    return {
      "day": d.Date,

      "count": (action == "attendance") ? +d.countAtt : (+d.countInv + (+d.countCon)),
      "zone": d.zone
    };
  })

  // get rid of zero count entries and sort the zones alphabetically
  dateCount = dateCount.filter(d => d.count != 0);
  dateCount = dateCount.sort(function(a, b){
    if(a.zone < b.zone) return -1;
    if(a.zone > b.zone) return 1;
    return 0;
  })
  return dateCount;
}


d3.csv('./surveySummary19.csv', function(d) {
  console.log(d);

});


//List of enumerators actions and shifts
var enumNames = ["Abdul Islam","ABDUL LATIF","AHMAD ALI", "M.  Nazim","M. Bilal", "Muhammad Azhar", "Abid Mehmood", "ALLAUD DIN SIDDIQUI","Dilawar Hussain",
"Dilawer Ayoub","JUNAID ASLAM RANA","M SIDDIQUE", "M.  Azam", "M ZULFIQAR","M.ARSHAD","Muhammad Arslan","Muhammad Azhar", "NOUMAN",
"Muhammad Hussain","Muhammad Rashid","Muhammad Suleman","Tanveer Ahsan","Tanveer Hussain", "Noor Ahmad", "Zubair Khan"];
var actions = ["attendance","survey" ];
var shifts = ["Morning","Evening","Night"];

// data to be plotted
var scaleCategorical = d3.scaleOrdinal(d3.schemeCategory20)
  .domain(surveySummary.map(d => d.zone).sort(function(a, b){
    if(a < b) return -1;
    if(a > b) return 1;
    return 0;
  }));

// Testing the functions
// var subsetData = transformData(surveySummary, "Tanveer Ahsan", "attendance", "Morning");
//
// // draw count calander and zone calander
// drawCalendar(subsetData, "#calendar", "count");
// drawCalendar(subsetData, "#calendar_with_zones", "zone");

drawLegend();

function drawCalendar(dateData, parentSelection, type){
  // removing all graphical elements that may already be present
  d3.select(parentSelection).selectAll('*').remove()

  var weeksInMonth = function(month){
    var m = d3.timeMonth.floor(month);
    return d3.timeWeeks(d3.timeWeek.floor(m), d3.timeMonth.offset(m,1)).length;
  }


  var minDate = new Date(2017, 06, 01);
  var maxDate = new Date(2019, 04, 01);

  var cellMargin = 1,
      cellSize = 15;

  var day = d3.timeFormat("%w"),
      week = d3.timeFormat("%U"),
      format = d3.timeFormat("%Y-%m-%d"),
      titleFormat = d3.utcFormat("%a, %d-%b");
      monthName = d3.timeFormat("%b %y"),
      months = d3.timeMonth.range(d3.timeMonth.floor(minDate), maxDate);

  var svg = d3.select(parentSelection).selectAll("svg")
    .data(months)
    .enter().append("svg")
    .attr("class", "month")
    .attr("height", ((cellSize * 7) + (cellMargin * 8) + 20) ) // the 20 is for the month labels
    .attr("width", function(d) {
      var columns = weeksInMonth(d);
      return ((cellSize * columns) + (cellMargin * (columns + 1)));
    })
    .append("g")

  svg.append("text")
    .attr("class", "month-name")
    .attr("y", (cellSize * 7) + (cellMargin * 8) + 15 )
    .attr("x", function(d) {
      var columns = weeksInMonth(d);
      return (((cellSize * columns) + (cellMargin * (columns + 1))) / 2);
    })
    .attr("text-anchor", "middle")
    .text(function(d) { return monthName(d); })

  var rect = svg.selectAll("rect.day")
    .data(function(d, i) {
      return d3.timeDays(d, new Date(d.getFullYear(), d.getMonth()+1, 1));
    })
    .enter().append("rect")
    .attr("class", "day")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("rx", 1).attr("ry", 1) // rounded corners
    .attr("fill", '#E0E0E0') // default light grey fill
    .attr("y", function(d) { return (day(d) * cellSize) + (day(d) * cellMargin) + cellMargin; })
    .attr("x", function(d) { return ((week(d) - week(new Date(d.getFullYear(),d.getMonth(),1))) * cellSize) + ((week(d) - week(new Date(d.getFullYear(),d.getMonth(),1))) * cellMargin) + cellMargin ; })
    .on("mouseover", function(d) {
      d3.select(this).classed('hover', true);
    })
    .on("mouseout", function(d) {
      d3.select(this).classed('hover', false);
    })
    .datum(format);


    d3.selectAll(".day").on("mouseover", function(d, i){
      var isZone = $(this).parent().parent().parent().attr('id');

      d3.select('body').append('div')
        .classed('animated', true)
        .classed('fadeInOpac', true)
        .classed('tool', true)
        .attr('id', 'hoverbox');

      var tooltip = d3.select('.tool');

      tooltip.append('div')
      .classed('toolhead', true)
      .append('div')
      .classed('toolheadData', true)
      .html(function(){
        return '<p class="datePara"><span class="dateHead">Day: </span><span class="lato">' + titleFormat(new Date(d)) + '</span></p>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      });

      d3.select('.toolhead')
      .append('div')
      .classed('toolheadIcon', true)
      .html(function(){
        return '<i class="fas fa-tree"></i>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
      });

      if (lookup[d]) {
        tooltip.append('div')
        .classed('sectionHead', true)
        .html(function(){
          return '<div class="sectionHeadingContain"><p class="sectionHeading">Acitivty Summary</p><i class="fas fa-info-circle"></i></div><div class="separator"></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
        });

        tooltip.append('div')
        .classed('attendanceValue', true)
        .html(function(){
          return isZone === "calendar" ? '<div class="attendanceValues lato" id="present"><span style="margin-bottom: 15px" class="attendanceHead">Activity Count: </span><span>' + lookup[d].count + '</span></div>' : '<div class="attendanceValues lato" id="present"><span class="attendanceHead">Zone: </span><span>' + lookup[d].zone + '</span></div><div class="attendanceValues lato" id="present"><span style="margin-bottom: 15px" class="attendanceHead">Activity Count: </span><span>'+ lookup[d].count + '</span></div>'
        });
      }
      else {
        tooltip.append('div')
        .classed('sectionHead', true)
        .html(function(){
          return '<div class="sectionHeadingContain"><p class="sectionHeading">No Activity</p></div>' //+ ' vs ' + d.results[1].party + " ("+d.PrimaryDistrict+ " "+ d.seat +")";
        });
      }

      tooltip.style('top', d3.event.pageY - document.getElementById('hoverbox').getBoundingClientRect().height/2 + "px");
      if (d3.event.pageX < window.innerWidth/2) {
        tooltip.style('left', d3.event.pageX + 14 + "px");
      }
      else {
        tooltip.style('left', d3.event.pageX - 260 + "px");
      }
    });

    d3.selectAll(".day").on("mouseout", function(d, i){
      d3.selectAll('.tool').remove()
    });


  var lookup = d3.nest()
    .key(function(d) { return d.day; })
    .rollup(function(leaves) {
      return {
        "count": d3.sum(leaves, function(d){ return parseInt(d.count); }),
        "zone": leaves[0].zone
      }
    })
    .object(dateData);

  var scale = d3.scaleLinear()
    .domain(d3.extent(dateData, function(d) { return parseInt(d.count); }))
    .range([0.4,1]); // the interpolate used for color expects a number in the range [0,1] but i don't want the lightest part of the color scheme


  rect.filter(function(d) { return d in lookup; })
    .transition()
    .ease(d3.easeSin)
    .duration(500)
    .style("fill", function(d) {
      if (type == "count"){
        return d3.interpolatePuBu(scale(lookup[d].count));
      }
      else {
        return scaleCategorical(lookup[d].zone);
      }
    });
}

function drawLegend() {
  // draw a legend
  var legSVG = d3.select("#zone_legend")
                .append('svg')
                .attr('height', 300)
                .attr('width', 800)
                .attr('id', 'calendarZoneLegendSVG');

  var scaleforLegend = d3.scaleOrdinal(d3.schemeCategory20)
    //.domain(subsetData.map(d => d.zone));
    .domain(["ED", "GIP", "GORs", "I", "II", "III", "IV", "JP", "PD-RR", "PDLBC", "PHAOS", "P-GIP", "V", "VI", "VII"])

  console.log(scaleCategorical.domain());

  legSVG.append("g")
    .attr("class", "legendOrdinal")
    .attr("transform", "translate(20,20)");

  var legendOrdinal = d3.legendColor()
                        .shapeWidth(40)
                        .shapePadding(1)
                        .scale(scaleforLegend)
                        .orient("horizontal");

  legSVG.select(".legendOrdinal")
    .call(legendOrdinal);
}
