# International Travel Explorer
An interactive dashboard using amCharts and Shiny, visualising provisional international travel data from visitor arrival cards released by [StatsNZ](https://www.stats.govt.nz/indicators/international-travel-provisional). Run using runApp() on the top working directory.

## Background and data
Data measuring travellers going in and out of New Zealand has traditionally only been available on a monthly basis: the International Travel dataset. As COVID-19 measures sent the border into a state of flux, StatsNZ has made provisional International Travel data available on a weekly basis since 2020, with around a two-week delay. Because StatsNZ only publishes the last 120 or so weeks of data, I will concatenate the publicly available data with an older version I’ve obtained.
The provisional International Travel dataset is spread across three time series: weekly arrival data, daily arrivals and departures data, and stock estimates of travellers. I will focus on the first time series which contains the most useful information, particularly for tourism decision makers. This time series uses arrival card data, allowing us to separate NZ residents from overseas visitors, and break down by the purpose of travel (e.g. business, holiday). Other dimensions include their length of stay, the NZ port they arrived in, and their country of residence. One measure is available, the total movements of a particular traveller group. I will join the country and port information with geocode data using Nominatim, a query API, to get the ports’ coordinates. 

## Goals
The main aim of this dashboard is to visualise international arrival data in a more meaningful way (geographically) than traditional graphs that become very dense as more series/countries are added. Another aim is to make more timely data accessible, with a delay of only two weeks and a weekly cadence, as opposed to two months as is the limitation of the monthly official International Travel dataset from StatsNZ. This timeliness means that we can track changes at the border more rapidly, such as the staged border reopening throughout 2022. Data on Australian citizen arrivals will be available from 4 May, and visa-waiver citizens from 25 May. The most useful cut for tourism decision makers will be purpose of travel, showing how the proportion of holidaymakers or business travellers compare to 2019 (pre-COVID) or 2021 (trans-Tasman bubble).

## Functionality
The main view of the International Travel Dashboard is a map centred on New Zealand. Nodes will be placed on each overseas country and NZ port. Each overseas node will be sized based on how many arrivals to the connecting port originated from said country, and each NZ port will be sized based on the total arrivals at the port. Edges connect nodes as per the data using splines, and coloured based on the percentage change on the figure in the same week in 2019 (using lubridate’s week() numbering). Only the edges connecting to one NZ port will be shown, clicking another NZ port will switch to showing the edges connected to the clicked NZ port.
Below the map, options will be provided to change the data cut. Dropdown menus will be added to switch between showing visitor counts with different lengths of stay, different purposes of travel, and switching between visitor and NZ resident arrivals. Another row will add a slider that enables the user to change which week is shown. 
Below the map, three line graphs will show the arrival counts with three different splits, by country of residence, by purpose of travel, and by length of stay. When clicking on a node or country, the graphs will filter out the counts for a particular arrival port or country of residence (clicking New Zealand will reset the graphs to the default national counts).

## Plan
### Phase 1: Static proof of concept (due 15 May)
Get an unstyled map chart on amCharts working with static data (fixed time period and factor levels, just nodes and edges)
### Phase 2: Dynamic amCharts features (due 22 May)
Add an amCharts slider to adjust time period, tooltips for nodes and edges
### Phase 3: Link Shiny (due 29 May)
Add dropdown menus using Shiny
### Phase 4: Add line charts (due 5 June)
Add 3 time series line charts below the chart controls, breaking down by country of residence, by purpose of travel and by length of stay. Charts update dynamically based on what's selected.
### Phase 5: Nice to haves (due 12 June)
Visitor/residents toggle, colour edges by growth on 2019 levels (requiring imputation of pre-2019-04-14 figures), dark sexy styling.
