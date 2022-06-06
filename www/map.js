$(document).on("shiny:connected", () => {
    am4core.useTheme(am4themes_animated);
    am4core.ready(() =>{
        // let purpose = "All purposes of travel";
        // let length = "All lengths of stay";
        let destination = "Auckland airport";
        const destinations = ["Auckland airport", "Wellington airport", "Christchurch airport", "Queenstown airport", "New Zealand"];
        let colorSet = new am4core.ColorSet();

        // 1. Create root map chart, centred on NZ ------------------------------------
        let mapChart = am4core.create("map", am4maps.MapChart);
        mapChart.geodata = am4geodata_worldLow;
        mapChart.projection = new am4maps.projections.EqualEarth();
        mapChart.deltaLongitude = -160;
        // No dragging to move
        mapChart.panBehavior = "none";
        // No scrolling to zoom
        mapChart.maxZoomLevel = 1;

        // 2. Create country polygons from geodata without Antarctica  ------------------------------------
        let polygons = mapChart.series.push(new am4maps.MapPolygonSeries());
        polygons.useGeodata = true;
        polygons.exclude = ["AQ"];

        // 3. Create edge templates, and promise it data from Shiny ------------------------------------
        let edges = mapChart.series.push(new am4maps.MapArcSeries());
        edges.mapLines.template.line.controlPointDistance = 0.1;
        edges.mapLines.template.line.controlPointPosition = 0.5;
        edges.mapLines.template.line.strokeWidth = 10;
        edges.mapLines.template.line.stroke = "#777";
        Shiny.addCustomMessageHandler('edge-data', (data) => {
            edges.mapLines.clear();
            let nodeBullets = nodes.mapImages.values;
            data.forEach(edge => {
                let origin = nodeBullets.find(node => node.Name === edge.From);
                let dest = nodeBullets.find(node => node.Name === edge.To);
                let line = edges.mapLines.create();
                // Link the two
                line.imagesToConnect = [origin, dest];
            });
        });

        // 4. Create node templates, and promise it data from Shiny ------------------------------------
        let nodes = mapChart.series.push(new am4maps.MapImageSeries());
        Shiny.addCustomMessageHandler('node-data', (data) => {
            colorSet.reset();
            // Assign a colour and radius
            data.forEach(node => {
                node.Color = colorSet.next();
                if (node.Type === "From") {
                    node.Radius = 45 * Math.log(node.Count * 1.5 / 50000 + 1.1);
                } else {
                    node.Radius = 5
                }
            });
            if (nodes.data === undefined) {
                nodes.data = data;
            } else {
                // Add data in-place if data already defined
                nodes.data.forEach(node => {
                    let newNode = data.find(n => n.Name === node.Name);
                    if (newNode === undefined) {
                        nodes.data.splice(nodes.data.indexOf(node), 1);
                    } else {
                        node.Count = newNode.Count;
                        node.Radius = newNode.Radius;
                        node.TimePeriod = newNode.TimePeriod;
                        data.splice(data.indexOf(newNode), 1);
                    }
                });
                nodes.data.push(...data);
                nodes.invalidateData();
            }
            weekLabel.text = nodes.data[0].TimePeriod;
        })

        let nodeTemplate = nodes.mapImages.template;
        nodeTemplate.propertyFields.latitude = "Latitude";
        nodeTemplate.propertyFields.longitude = "Longitude";
        nodeTemplate.propertyFields.title = "Name";
        nodeTemplate.propertyFields.value = "Count";
        nodeTemplate.propertyFields.radius = "Radius";
        nodeTemplate.tooltipText = "{title}: {value} arrivals";
        // Make clicking nodes dynamic
        nodeTemplate.events.on("hit", (ev) => {
            if (destinations.includes(ev.target.title)) {
                destination = ev.target.title
                // updateEdges(slider.start, true);
            }
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
        playButton.events.on("toggled", function (event) {
            if (event.target.isActive) {
                if (slider) {
                    if (slider.start >= 1) {
                        slider.start = 0;
                        sliderAnimation.start();
                    }
                    sliderAnimation.setProgress(slider.start);
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

        // Calculate what index to use based on slider value
        function interpolateWeekFromValue(value) {
            return 1 + Math.round(value * sliderRange);
        }

        // Update chart data in place
        // function updateEdges(value) {
        //     let week = interpolateWeekFromValue(value);

            // if (currentSlider !== week || cutChanged) {
                // destData.forEach(conn => {
                //     dest.children.each(circle => circle.opacity = 1);
                //     // And mask the other destination nodes
                //     bullets.filter(x => destinations.includes(x.title) && x.title !== conn.To)
                //         .forEach(dest => {
                //             dest.children.each(circle => circle.opacity = 0.5);
                //         })
                // });
            // }
        // }

        // Add week slider
        let slider = weekSliderContainer.createChild(am4core.Slider);
        slider.orientation = "horizontal";
        slider.width = am4core.percent(100);
        slider.valign = "middle";
        slider.startGrip.events.on("drag", stop);
        // Set initial value and tell Shiny
        slider.start = 1;
        Shiny.setInputValue("slider", slider.start);
        slider.events.on("rangechanged", (ev) => {
            // Pass a change in slider over to Shiny
            Shiny.setInputValue("week_ended", interpolateWeekFromValue(ev.target.start));
        });
        let sliderRange;
        Shiny.addCustomMessageHandler("slider-range", (range) => {
            sliderRange = range
            sliderAnimation.duration = 500 * sliderRange
        });
        // and make an animation for the play button to slide the button ("start") across
        let sliderAnimation = slider.animate({
            property: "start",
            from: 0,
            to: 1
        }, 500, am4core.ease.linear).pause();
        sliderAnimation.setProgress(1);

        // Add container for week min/max labels
        let weekSliderLabels = weekSliderContainer.createChild(am4core.Container);
        weekSliderLabels.width = am4core.percent(100);

        // let startSliderLabel = weekSliderLabels.createChild(am4core.Label);
        // startSliderLabel.valign = "middle";
        // startSliderLabel.align = "left";
        // startSliderLabel.fontSize = 12;
        //
        // let endSliderLabel = weekSliderLabels.createChild(am4core.Label);
        // endSliderLabel.valign = "middle";
        // endSliderLabel.align = "right";
        // endSliderLabel.fontSize = 12;

        // Add week label to the right
        let weekLabel = bottomContainer.createChild(am4core.Label);
        weekLabel.valign = "middle";
        weekLabel.fill = am4core.color("#444444");
        weekLabel.fontSize = 16;
        weekLabel.marginLeft = 15;
    });
});