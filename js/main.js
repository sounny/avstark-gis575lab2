
//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope 
(function(){

    //pseudo-global variables
    var attrArray = ["varA", "varB", "varC", "varD", "varE"]; //list of attributes csv
    var expressed = attrArray[0]; //attribute at index[0] (starting point)
    
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([chartHeight - 10, 0])
        .domain([0, 88*1.1]); // csv first column max = 88
    
    
    //begin script when window loads
    window.onload = setMap();
    
    //set up choropleth map
    function setMap(){
        
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 460;
    
        //create new svg container for the map
        //create container for the svg
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);
    
        //Albers Conic Projection center is 
        var projection = d3.geoAlbers()
            .center([0, 39.83])
            .rotate([97.65, 0])
            .parallels([40, 35])
            .scale(900)
            .translate([width / 2, height / 2]);
        
            
        //path generator
        var path = d3.geoPath()
            .projection(projection); //one operator to pass projection generator as parameter
            console.log("this is the path: ", path);
    
        //use Promise.all to parallelize asynchronous data loading
        var promises = [];
       
        /*data loading using the Promise.all(promises) generator
        Promise.all takes an iterable of promises as an input, returns 1 array
        call back function will execute after all the data is loaded
        ____________________________________________________________________________*/
        promises.push(d3.csv("data/farm_data.csv")); 
        promises.push(d3.json("data/states_USA.topojson"));
        promises.push(d3.json("data/contig_48.topojson")); 
        var all = Promise.all(promises).then(callback);
        
        console.log("this is promises: ", promises);
        console.log("this is Promise.all : ", all);
        
        
        function callback (data) {
            [csvData, usCountry, usStates] = data; //this is the data parameter that is passed to callback
            //the global variables declared above 
            console.log("this is the data: ", data); //csv and 2 topology arrays
             
            //place graticule on the map
            setGraticule(map, path);
    
            //extract all the features as an array to be passed to .data() --> topo to geo
            var usWhole = topojson.feature(usCountry, usCountry.objects.usWhole),
                states48 = topojson.feature(usStates, usStates.objects.contig_48).features;
                console.log("this is the states: ", states48);
                
            //add the US to the map one datum
             var usBackground = map.append("path")
             .datum(usWhole)
             .attr("class", "usBackground")
             .attr("d", path);
            //join csv data to states enumeration units redefine var states48
            states48 = joinData(states48, csvData);  //callback to joinData
    
            //create the color scale
            var colorScale = makeColorScale(csvData);
    
            //add enumeration units to the map
            setEnumerationUnits(states48, map, path, colorScale);
    
            //add coordinated visualization to the map
            //setChart(csvData, colorScale);
    
            // dropdown
            //createDropdown(csvData);
    
        };
    }; //end of setMap()
    
    
    function setGraticule(map, path){
        // graticule generator
        var graticule = d3.geoGraticule()
            .step([10, 10]); //if specified step sets major and minor 5 degrees of lng/lat
            
    
        //create graticule background by binding datum 
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //.outline returns GeoJSON geom object for the graticule outline
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) 
            //svg path element with attribute "d" is appended to map and assigned the path generator
            //this passes datum to path generator, returns path coordinate string to "d" attribute
    
        //create graticule lines	
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
                .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
    };
    
    function joinData(usStates, csvData){
        
        //loop through csv to assign each set of csv attribute values to geojson 
        for (var i=0; i<csvData.length; i++){
            var csvState = csvData[i]; //usState at the current index
            var csvKey = csvState.name; //CSV primary key for join
    
            //loop through geojson regions to find correct state
            for (var a=0; a <usStates.length; a++){
    
                var geojsonProps = usStates[a].properties; //the current usState's geojson properties
                var geojsonKey = geojsonProps.name; //geojson primary key for join
    
                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){
    
                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var values = parseFloat(csvState[attr]); //get csv attribute value
                        geojsonProps[attr] = values; //assign attribute and value to geojson properties
                    });
                };
            };
        };
    
    
        return usStates;
    };
    
    //Create Color Scale 
    function makeColorScale(data){
        //ColorBrewer
        var colorClasses = [
            "#EDF8FB",
            "#B2E2E2",
            "#66C2A4",
            "#2CA25F",
            "#006D2C"
        ];
    
        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);
    
        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };
    
        //cluster data using ckmeans(simple-statistics) clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        console.log("this is clusters: ",clusters);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();
    
        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);
        console.log(domainArray);
    
        return colorScale;
    };
       
    //function to test for data value and return color
    function choropleth(props, colorScale){
        //make sure attribute value is a number
        var values = Number.parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof values == 'number' && !isNaN(values)){
            return colorScale(values);
        } else {
            return "#CCC";
        };
    };
    
    //set the States 
    function setEnumerationUnits(states48, map, path, colorScale) {
        //add 48 contig states to map
        var states = map.selectAll(".states")
            .data(states48)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.name;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            
            .on("mouseover", function(d){
                console.log("this is d in the mouseover: ",d);
                //highlight(d.properties);//check for needing (d.currentTarget.__data__)
            })
           /* .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel); */
        
        //below Example 2.2 line 16...add style descriptor to each path
        var desc = states.append("desc")
        .text('{"stroke": "#000", "stroke-width": "0.5px"}');
        console.log("this is the description: ", desc);
          
    };
    
    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
    
        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
    
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    
    
        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.name;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
    
        //below Example 2.2 line 31...add style descriptor to each rect
        var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Number of Variable " + expressed[3] + " in each region");
    
        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);
    
        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
    
        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    
        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);
    };
    
    //Example 1.1 line 1...function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });
    
        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");
    
        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };
    
    //Example 1.4 line 14...dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;
    
    
        // change yscale dynamically
        csvmax = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });
        
        yScale = d3.scaleLinear()
            .range([chartHeight - 10, 0])
            .domain([0, csvmax*1.1]);
    
        //updata vertical axis 
        d3.select(".axis").remove();
        var yAxis = d3.axisLeft()
            .scale(yScale);
    
        //place axis
        var axis = d3.select(".chart")
            .append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
        
    
        //recreate the color scale
        var colorScale = makeColorScale(csvData);
    
        //recolor enumeration units
        var regions = d3.selectAll(".regions")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
    
        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
            //re-sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function(d, i){
                return i * 20
            })
            .duration(500);
    
        updateChart(bars, csvData.length, colorScale);
    };
    
    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
        
        //add text to chart title
        var chartTitle = d3.select(".chartTitle")
            .text("Number of Variable " + expressed[3] + " in each region");
    };
    
    //function to highlight enumeration units and bars
    /*function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.name)
        .style("stroke", "blue")
        .style("stroke-width", "2");
    
        setLabel(props);
        
    };
    
    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.name)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });
        
        //below Example 2.4 line 21...remove info label
        d3.select(".infolabel")
            .remove();
    
        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();
    
            var styleObject = JSON.parse(styleText);
    
            return styleObject[styleName];
        };
    };
    */
    //function to create dynamic label
    function setLabel(props){
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";
    
        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.name + "_label")
            .html(labelAttribute);
    
        var stateName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.name);
    };
    
    //function to move info label with mouse 
    //Example 2.8 line 1...function to move info label with mouse
    /*//move info label with mouse
    function moveLabel(event){
        //use coordinates of mousemove event to set label coordinates
        var x = event.clientX + 10,
            y = event.clientY - 75;    
        
        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    }; 
    //end moveLabel()*/
    /*function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;
    
        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;
    
        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1; 
    
        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");    
    };  */
    
    })(); //last line of main.js