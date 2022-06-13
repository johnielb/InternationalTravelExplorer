$(document).on("shiny:connected", () => {
    am4core.useTheme(am4themes_animated);
    am4core.ready(() =>{
        let colorSet = new am4core.ColorSet();

        // 1. Create root map chart, centred on NZ ------------------------------------
        let mapChart = am4core.create("map", am4maps.MapChart);
        mapChart.geodata = am4geodata_worldLow;
        mapChart.projection = new am4maps.projections.Projection();
        mapChart.deltaLongitude = -160;
        // No dragging to move
        mapChart.panBehavior = "none";
        // No scrolling to zoom
        mapChart.maxZoomLevel = 1; 

        // 2. Create country polygons from geodata without Antarctica  ------------------------------------
        let polygons = mapChart.series.push(new am4maps.MapPolygonSeries());
        polygons.useGeodata = true;
        polygons.exclude = ["AQ"];

        // 3. Create edge and node templates ------------------------------------
        let edges = mapChart.series.push(new am4maps.MapArcSeries());
        edges.mapLines.template.line.controlPointDistance = 0.1;
        edges.mapLines.template.line.controlPointPosition = 0.5;
        edges.mapLines.template.line.strokeWidth = 6;
        edges.mapLines.template.line.stroke = "#777";
        let nodes = mapChart.series.push(new am4maps.MapImageSeries());
        let nodeTemplate = nodes.mapImages.template;
        nodeTemplate.propertyFields.latitude = "Latitude";
        nodeTemplate.propertyFields.longitude = "Longitude";
        nodeTemplate.propertyFields.title = "Name";
        nodeTemplate.propertyFields.value = "Count";
        nodeTemplate.propertyFields.radius = "Radius";
        nodeTemplate.propertyFields.opacity = "Opacity";
        nodeTemplate.tooltipText = "{title}: {value} arrivals";
        // Make clicking nodes dynamic
        nodeTemplate.events.on("hit", ev => {
            let data = ev.target.dataItem.dataContext;
            if (data.From === undefined) {
              Shiny.setInputValue("port", data.Name);
            }
            Shiny.setInputValue("last_node", data.Name);
        });
        let staticCircle = nodeTemplate.createChild(am4core.Circle);
        staticCircle.propertyFields.radius = "Radius";
        staticCircle.propertyFields.fill = "Color";
        staticCircle.nonScaling = true;
        // let circle = nodeTemplate.createChild(am4core.Circle);
        // circle.radius = 5;
        // circle.propertyFields.fill = "Color";
        // circle.events.on("inited", ev => animateBullet(ev.target));
        // let animateBullet = bullet => {
        //     let animation = bullet.animate([
        //         {
        //             property: "scale",
        //             from: 1,
        //             to: 3
        //         }, {
        //             property: "opacity",
        //             from: 1,
        //             to: 0
        //         }
        //     ], 1500, am4core.ease.circleOut);
        //     animation.events.on("animationended", ev => animateBullet(ev.target.object));
        // };

        // 4. Promise the nodes and edges data from Shiny
        Shiny.addCustomMessageHandler('data', (data) => {
            // Start assigning colours from scratch
            colorSet.reset();
            // Deep clone data for nodes, act as a stack to clear
            let newNodeData = JSON.parse(JSON.stringify(data));
            // Get destination, assuming From-To edge data is in the first row
            let destination = newNodeData[0].To;
            // Assign a colour and radius
            newNodeData.forEach(node => {
                node.Color = colorSet.next();
                node.Opacity = 1;
                if (node.From === undefined) {
                    node.Name = node.To;
                    node.Radius = 6;
                    if (node.Name !== destination) node.Opacity = 0.5;
                } else {
                    node.Name = node.From
                    node.Radius = 30 * Math.log(node.Count / 25000 + 1.15);
                }
            });
            nodes.data = newNodeData;
            nodes.validateData();
            let timePeriod = nodes.data[0].TimePeriod;
            weekLabel.text = timePeriod;

            edges.mapLines.clear();
            let nodeBullets = nodes.mapImages.values;
            data.forEach(edge => {
                let origin = nodeBullets.find(node => node.title === edge.From);
                let dest = nodeBullets.find(node => node.title === edge.To);
                if (origin === undefined || dest === undefined) return;
                let line = edges.mapLines.create();
                // Link the two
                line.imagesToConnect = [origin, dest];
            });

            charts.forEach(c => {
                let x = c.xAxes.getIndex(0).axisRanges.getIndex(0);
                x.date = new Date(timePeriod);
            });
        });
        // When nodes have data updated, turn the destination nodes into squares
        nodes.events.on("datavalidated", ev => {
            ev.target.mapImages.values
                .filter(i => i.dataItem.dataContext.From === undefined)
                .forEach(i => {
                    i.children.clear();
                    let square = i.createChild(am4core.Rectangle);
                    let data = i.dataItem.dataContext;
                    square.width = data.Radius*2;
                    square.height = data.Radius*2;
                    square.fill = data.Color;
                    square.horizontalCenter = "middle";
                    square.verticalCenter = "middle";
                });
        });

        // 5. Set up slider ------------------------------------

        // Create container for week slider, play button and label
        let bottomContainer = mapChart.createChild(am4core.Container);
        bottomContainer.layout = "horizontal";
        bottomContainer.align = "center";
        bottomContainer.valign = "bottom";
        bottomContainer.width = am4core.percent(90);

        // Add play button for slider
        let playButton = bottomContainer.createChild(am4core.PlayButton);
        playButton.valign = "middle";
        playButton.events.on("toggled", ev => {
            if (ev.target.isActive) {
                if (slider) {
                    if (slider.end >= 1) {
                        slider.end = 0;
                        sliderAnimation.start();
                    }
                    sliderAnimation.setProgress(slider.end);
                    sliderAnimation.resume();
                    playButton.isActive = true;
                }
            } else {
                sliderAnimation.pause();
                playButton.isActive = false;
            }
        });

        // Create container for week slider and its min/max labels below it
        let weekSliderContainer = bottomContainer.createChild(am4core.Container);
        weekSliderContainer.layout = "vertical";
        weekSliderContainer.valign = "middle";
        weekSliderContainer.width = am4core.percent(100);
        weekSliderContainer.marginLeft = 20;

        // Add week slider
        let slider = weekSliderContainer.createChild(am4charts.XYChartScrollbar);
        slider.orientation = "horizontal";
        slider.width = am4core.percent(100);
        slider.valign = "middle";
        // Put the other grip to the start and hide it
        slider.start = 0;
        slider.startGrip.hide();
        slider.thumb.hide();
        slider.thumb.events.disable();
        slider.endGrip.events.on("drag", stop);
        // Keep the end grip as the sole button, and set its initial value and tell Shiny
        slider.end = 1;
        // Shiny.setInputValue("slider", slider.end);
        slider.events.on("rangechanged", ev => {
            // Pass a change in slider over to Shiny
            Shiny.setInputValue("week_ended", 1 + Math.round(ev.target.end * sliderRange));
        });
        // Set slider range based on how many weeks in the data
        let sliderRange;
        Shiny.addCustomMessageHandler("slider-range", (range) => {
            sliderRange = range
            sliderAnimation.duration = 500 * sliderRange
        });
        // and make an animation for the play button to slide the button ("end") across
        let sliderAnimation = slider.animate({
            property: "end",
            from: 0,
            to: 1
        }, 500, am4core.ease.linear).pause();
        sliderAnimation.setProgress(1);
        
        // Sneak in a line chart into the slider!
        let totalChart = am4core.create("", am4charts.XYChart);
        let x = totalChart.xAxes.push(new am4charts.DateAxis());
        x.renderer.minGridDistance = 40;
        let y = totalChart.yAxes.push(new am4charts.ValueAxis());
        y.extraMin = 0.01;
        y.extraMax = 0.01;
        let totalSeries = totalChart.series.push(new am4charts.LineSeries());
        totalSeries.dataFields.valueY = "Count";
        totalSeries.dataFields.dateX = "TimePeriod";
        totalSeries.strokeWidth = 3;
        totalSeries.connect = false;
        slider.series.push(totalSeries);
        Shiny.addCustomMessageHandler('scrollbar', (data) => {
          totalChart.data = data;
        });

        // Add container for week min/max labels
        let weekSliderLabels = weekSliderContainer.createChild(am4core.Container);
        weekSliderLabels.width = am4core.percent(100);

        // Add week label to the right
        let weekLabel = bottomContainer.createChild(am4core.Label);
        weekLabel.valign = "middle";
        weekLabel.fill = am4core.color("#444444");
        weekLabel.fontSize = 16;
        weekLabel.marginLeft = 15;

        // 6. Add line charts -----------------------------------------
        function createLineChart(id) {
            let chart = am4core.create(id, am4charts.XYChart);
            chart.padding(0,0,0,0);
            chart.numberFormatter = new am4core.NumberFormatter();
            chart.numberFormatter.numberFormat = "#,###.#a";

            // Set up title
            let titleLabel = chart.titles.create();
            titleLabel.text = "Arrivals";
            titleLabel.align = "left";
            titleLabel.fontSize = 16;
            titleLabel.marginTop = 15;
            titleLabel.marginBottom = 5;

            // Set up axes
            let x = chart.xAxes.push(new am4charts.DateAxis());
            x.renderer.minGridDistance = 40;
            x.renderer.labels.template.fontSize = 12;
            x.dateFormats.setKey("week", "dd MMM yyyy")
            x.dateFormatter.firstDayOfWeek = 0;  
            let guide = x.axisRanges.create();
            guide.grid.strokeWidth = 2;
            guide.grid.strokeOpacity = 1;
            guide.grid.stroke = am4core.color("#777");
            let y = chart.yAxes.push(new am4charts.ValueAxis());
            y.renderer.labels.template.fontSize = 12;

            // Set up legend
            chart.legend = new am4charts.Legend();
            chart.legend.position = "top";
            chart.legend.scrollable = true;
            chart.legend.maxHeight = 50;
            chart.legend.labels.template.fontSize = 12;
            chart.legend.itemContainers.template.padding(0,0,0,0);
            chart.legend.marginBottom = 5;

            // Set up cursor
            chart.cursor = new am4charts.XYCursor();
            chart.cursor.xAxis = x;
            chart.cursor.yAxis = y;
            chart.cursor.maxTooltipDistance = 30;
            return chart;
        }

        function updateLineChart(chart, data, title) {
            if (chart.data === undefined || chart.data.length === 0 || chart.series.length === 0) {
                chart.colors.reset();
                let keys = Object.keys(data[0]).filter(k => k !== "TimePeriod");
                for (let category of keys) {
                    let series = chart.series.push(new am4charts.LineSeries());
                    series.name = category;
                    series.dataFields.valueY = category;
                    series.dataFields.dateX = "TimePeriod";
                    series.tooltipText = "{name}: {valueY}"
                    series.strokeWidth = 2;
                    series.connect = false;
                }
            }
            chart.data = data;
            chart.titles.getIndex(0).text = title;
        }

        let nodeChart = createLineChart("nodeChart");
        let purposeChart = createLineChart("purposeChart");
        let lengthChart = createLineChart("lengthChart");
        let charts = [nodeChart, purposeChart, lengthChart];

        Shiny.addCustomMessageHandler('charts', (data) => {
            // If the nodes (sorted by R) don't match in the chart, clear and rebuild
            let keys = Object.keys(data.Node[0]).filter(k => k !== "TimePeriod");
            let firstNode = nodeChart.series.getIndex(0);
            if (firstNode && firstNode.title !== keys[0]) nodeChart.series.clear();

            updateLineChart(nodeChart, data.Node, data.Title[0]);
            updateLineChart(purposeChart, data.Purpose, data.Title[1]);
            updateLineChart(lengthChart, data.Length, data.Title[2]);
        });
    });
});