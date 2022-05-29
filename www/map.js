am4core.ready(() =>{
    let purpose = "All purposes of travel";
    let length = "All lengths of stay";
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

    // 3. Create edge templates, and point to data source ------------------------------------
    let edges = mapChart.series.push(new am4maps.MapArcSeries());
    edges.mapLines.template.line.controlPointDistance = 0.1;
    edges.mapLines.template.line.controlPointPosition = 0.5;
    edges.mapLines.template.line.strokeWidth = 10;
    edges.mapLines.template.line.stroke = "#777";
    edges.dataSource.url = "data/allData.json";
    edges.dataSource.parser = new am4core.JSONParser();
    edges.dataSource.parser.options.emptyAs = 0;

    // 4. Create node templates, and point to geodata source ------------------------------------
    let nodes = mapChart.series.push(new am4maps.MapImageSeries());
    nodes.dataSource.url = "data/geocodes.json";
    nodes.dataSource.parser = new am4core.JSONParser();
    nodes.dataSource.parser.options.emptyAs = 0;
    // 5. Initiate chart loading when geodata loaded ------------------------------------
    nodes.dataSource.events.on("done", ev => {
        ev.target.data.forEach(node => {
            node.Color = colorSet.next();
        });

        // 6. Load edges ------------------------------------
        edges.dataSource.load();
        edges.dataSource.events.on("done", ev => {
            let cutData = ev.target.data[purpose][length];
            // On first init, set up the slider values that are currently empty.
            let value = 1; // 100% of the chart slider
            endSlider = cutData.length-1;
            endSliderLabel.text = cutData[endSlider].TimePeriod;
            startSliderLabel.text = cutData[startSlider].TimePeriod;

            // Only add dynamic features when the slider bounds are ready ----------------
            // Respond to slider change
            slider.events.on("rangechanged", function () {
                updateEdges(slider.start);
            });
            // Create animation that moves the slider when the play button is toggled
            sliderAnimation = slider.animate({
                property: "start",
                from: 0,
                to: 1
            }, sliderRange() * 500, am4core.ease.linear).pause()
            sliderAnimation.setProgress(1);
            // Then update
            updateEdges(value);
        });
    });

    // 7. Set up how nodes appear, animated! ------------------------------------
    let nodeTemplate = nodes.mapImages.template;
    nodeTemplate.propertyFields.latitude = "Latitude";
    nodeTemplate.propertyFields.longitude = "Longitude";
    nodeTemplate.propertyFields.title = "Name";
    nodeTemplate.propertyFields.value = "Value";
    nodeTemplate.tooltipText = "{title}";
    // Make clicking nodes dynamic
    nodeTemplate.events.on("hit", (ev) => {
        if (destinations.includes(ev.target.title)) {
            destination = ev.target.title
            updateEdges(slider.start, true);
        }
    });
    let staticCircle = nodeTemplate.createChild(am4core.Circle);
    staticCircle.radius = 5;
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

    // 8. Set up slider ------------------------------------

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
        return startSlider + Math.round(value * sliderRange(startSlider, endSlider));
    }

    // Update chart data in place
    function updateEdges(value, cutChanged) {
        // If nothing loaded yet, leave
        if (edges.dataSource.data === undefined) return;

        let week = interpolateWeekFromValue(value);
        if (currentSlider !== week || cutChanged) {
            currentSlider = week;
            let cutData = edges.dataSource.data[purpose][length];
            let weekData = cutData[currentSlider].data;
            weekLabel.text = cutData[currentSlider].TimePeriod;
            let destData = weekData.filter(conn => conn.To === destination);
            let total = destData.reduce((a, b) => a + b.Value, 0);
            let bullets = nodes.mapImages.values;
            // Clear state before building
            edges.mapLines.clear();
            bullets.forEach(b => b.children.each(circle => circle.radius = 5));
            // Build edges for each connection to the selected destination
            destData.forEach(conn => {
                let edge = edges.mapLines.create();
                // Update the origin node
                let origin = bullets.filter(x => x.title === conn.From)[0];
                // TODO: use data fields so Value updated automatically
                origin.tooltipText = `{title}: ${conn.Value} visitors`;
                // and weight based on the log of the values
                origin.children.each(circle => circle.radius = 70 * Math.log(conn.Value * 1.5 / 20000 + 1.1));
                // Update the destination node
                let dest = bullets.filter(x => x.title === conn.To)[0];
                dest.tooltipText = `{title}: ${total} arrivals`;
                dest.children.each(circle => circle.opacity = 1);
                // Link the two
                edge.imagesToConnect = [origin, dest];
                // And mask the other destination nodes
                bullets.filter(x => destinations.includes(x.title) && x.title !== conn.To)
                    .forEach(dest => {
                        dest.children.each(circle => circle.opacity = 0.5);
                    })
            });
            // Update other destinations' bullets with week data
            destinations.filter(d => d !== destination)
                .map(d => bullets.filter(b => b.title === d)[0])
                .forEach(b => {
                    let destData = weekData.filter(conn => conn.To === b.title);
                    let total = destData.reduce((a, b) => a + b.Value, 0);
                    b.tooltipText = `{title}: ${total} arrivals`;
                })
        }
    }
    // Add week slider
    let startSlider = 0;
    let endSlider = NaN;
    let sliderRange = () => (isNaN(endSlider)) ? NaN : endSlider-startSlider;
    let currentSlider = endSlider;
    let slider = weekSliderContainer.createChild(am4core.Slider);
    slider.orientation = "horizontal";
    slider.width = am4core.percent(100);
    slider.valign = "middle";
    slider.start = 1;
    slider.startGrip.events.on("drag", stop);
    let sliderAnimation;

    // Add container for week min/max labels
    let weekSliderLabels = weekSliderContainer.createChild(am4core.Container);
    weekSliderLabels.width = am4core.percent(100);

    let startSliderLabel = weekSliderLabels.createChild(am4core.Label);
    startSliderLabel.valign = "middle";
    startSliderLabel.align = "left";
    startSliderLabel.fontSize = 12;

    let endSliderLabel = weekSliderLabels.createChild(am4core.Label);
    endSliderLabel.valign = "middle";
    endSliderLabel.align = "right";
    endSliderLabel.fontSize = 12;

    // Add week label to the right
    let weekLabel = bottomContainer.createChild(am4core.Label);
    weekLabel.valign = "middle";
    weekLabel.fill = am4core.color("#444444");
    weekLabel.fontSize = 16;
    weekLabel.marginLeft = 15;
    // let latestTimePeriod = vaChart.data[0]["_TimePeriod"];
    // weekLabel.text = "Week " + currentSlider + " (" + latestTimePeriod + ")";
});