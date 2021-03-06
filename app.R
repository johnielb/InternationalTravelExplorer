library(shiny)
library(jsonlite)
library(dplyr)
# Suppress summarise info
options(dplyr.summarise.inform = FALSE)
library(tidyr)
library(forcats)
library(stringr)
library(lubridate)
library(readr)

ui <- fluidPage(
  tags$head(
    tags$script(src = "https://www.amcharts.com/lib/4/core.js"),
    tags$script(src = "https://www.amcharts.com/lib/4/charts.js"),
    tags$script(src = "https://www.amcharts.com/lib/4/maps.js"),
    tags$script(src = "https://www.amcharts.com/lib/4/themes/animated.js"),
    tags$script(src = "https://www.amcharts.com/lib/4/themes/amchartsdark.js"),
    tags$script(src = "https://www.amcharts.com/lib/4/geodata/worldLow.js"),
    tags$link(rel = "stylesheet", type = "text/css", href = "main.css")
  ),
  tags$script(src = "map.js"),
  fillPage(
    sidebarPanel(
      width = 3,
      h1("International Travel Data Explorer"),
      hr(),
      radioButtons(
        "purposes",
        "Filter by purpose of travel",
        choices = c(
          "All purposes of travel",
          "Business",
          "Holiday/vacation",
          "Visit friends/relatives",
          "Other"
        )
      ),
      hr(),
      radioButtons(
        "lengths",
        "Filter by length of stay",
        choices = c(
          "All lengths of stay",
          "01-03 days",
          "04-07 days",
          "08-14 days",
          "15-21 days",
          "22+ days"
        )
      )
    ),
    mainPanel(
      width = 9,
      fluidRow(
      	textOutput("header")
      ),
      fluidRow(
        id = "mapRow",
        column(12, tags$div(id = "map"))
      ),
      fluidRow(
        id = "chartRow",
        column(4, tags$div(id = "nodeChart")),
        column(4, tags$div(id = "purposeChart")),
        column(4, tags$div(id = "lengthChart"))
      )
    )
  )
)

# Wrangle VA data once at server startup
source("data/wrangle_va.R")
# Geodata won't change, so load once forever
if (!file.exists("data/geo.Rda")) {
  source("data/wrangle_geo.R")
} else {
  load("data/geo.Rda")
}

server <- function(input, output, session) {
  # Let amCharts know how many steps should be on the slider
  sliderRange <- reactive({
    range <- unique(va$Week_ended)
    return(length(range) - 1)
  })
  # Get the week-ended time period from the input week index
  getWeek <- reactive({
    index <- input$week_ended
    if (is.null(input$week_ended)) {
      index <- sliderRange()+1
    }
    range <- unique(va$Week_ended)
    return(range[index])
  })
  # React to changes to the radio button inputs once, all data except for the 
  # data for the line charts should come through here.
  filteredVAData <- reactive({
    va %>%
      filter(Length_of_stay == input$lengths, Travel_purpose == input$purposes) %>%
      return()
  })
  # Wrangle network data as an edge list
  updateMapData <- reactive({
    week_ended <- getWeek()
    nz_port <- input$port
    if (is.null(input$port)) {
      nz_port <- "New Zealand"
    }

    df <- filteredVAData()
    df %>%
      filter(NZ_port == nz_port, Week_ended == week_ended) %>%
      select(From = Country_of_residence, To = NZ_port, Count) %>%
      group_by(From, To) %>%
      summarise(Count = sum(Count)) %>%
      left_join(geo, by = c("From" = "Name")) %>%
      rbind(
        df %>%
          filter(Week_ended == week_ended) %>% 
          select(To = NZ_port, Count) %>%
          group_by(To) %>%
          summarise(Count = sum(Count)) %>%
          left_join(geo, by = c("To" = "Name"))
      ) %>%
      mutate(TimePeriod = week_ended) %>%
      toJSON() %>%
      return()
  })
  # Update the line series shown behind the slider
  updateScrollbarSeries <- reactive({
    nz_port <- input$port
    if (is.null(input$port)) {
      nz_port <- "New Zealand"
    }

    df <- filteredVAData()
    df %>%
      filter(NZ_port == nz_port) %>%
      select(TimePeriod = Week_ended, Count) %>%
      group_by(TimePeriod) %>%
      summarise(Count = sum(Count)) %>%
      toJSON() %>%
      return()
  })
  # Helper for wrangling the line chart data, selecting one particular category
  selectOneCategory <- function(df, category) {
    df %>% 
      select(TimePeriod = Week_ended,
             Category = category,
             Value = Count) %>%
      group_by(TimePeriod, Category) %>%
      summarise(Value = sum(Value)) %>% 
      mutate(Category = fct_drop(Category)) %>%
      pivot_wider(names_from = "Category", values_from = "Value", values_fill = 0) %>% 
      toJSON() %>% 
      return()
  }
  # Update all 3 line charts
  updateCharts <- reactive({
    last_node <- input$last_node
    if (is.null(input$last_node)) {
      last_node <- "New Zealand"
    }
    node_title <- case_when(
      grepl("airport", last_node) ~ str_replace(last_node, " airport", ""),
      last_node == "New Zealand" ~ "NZ",
      last_node == "United Kingdom" ~ "UK",
      last_node == "United States of America" ~ "USA",
      TRUE ~ last_node
    )

    node_arrivals <- va
    titles <- c()
    if (last_node %in% levels(node_arrivals$NZ_port)) {
      node_arrivals <- node_arrivals %>% 
        filter(NZ_port == last_node)
      
      nodeData <- node_arrivals %>% 
        mutate(Country_of_residence = Country_of_residence %>% 
                 fct_recode("UK" = "United Kingdom",
                            "USA" = "United States of America")) %>% 
        filter(Travel_purpose == "All purposes of travel",
               Length_of_stay == "All lengths of stay") %>% 
        selectOneCategory("Country_of_residence")
      
      node_title <- paste("to", node_title)
      titles <- c(titles, paste("Arrivals", node_title, "by country of residence"))
    } else if (last_node %in% levels(node_arrivals$Country_of_residence)) {
      node_arrivals <- node_arrivals %>% 
        filter(Country_of_residence == last_node)
      
      nodeData <- node_arrivals %>% 
        filter(NZ_port != "New Zealand",
               Travel_purpose == "All purposes of travel",
               Length_of_stay == "All lengths of stay") %>% 
        mutate(NZ_port = NZ_port %>% 
                 fct_recode("Auckland" = "Auckland airport",
                            "Christchurch" = "Christchurch airport",
                            "Queenstown" = "Queenstown airport",
                            "Wellington" = "Wellington airport")) %>% 
        selectOneCategory("NZ_port")
      
      node_title <- paste("from", node_title)
      titles <- c(titles, paste("Arrivals", node_title, "by NZ port"))
      
      node_arrivals <- node_arrivals %>% 
        filter(NZ_port == "New Zealand")
    } else {
      stop("Invalid node passed to updateCharts")
    }
    
    purposeData <- node_arrivals %>%
      filter(Travel_purpose != "All purposes of travel",
             Length_of_stay == "All lengths of stay") %>% 
      selectOneCategory("Travel_purpose")
    titles <- c(titles, paste("Arrivals", node_title, "by travel purpose"))
    
    lengthData <- node_arrivals %>%
      filter(Travel_purpose == "All purposes of travel",
             Length_of_stay != "All lengths of stay") %>% 
      selectOneCategory("Length_of_stay")
    titles <- c(titles, paste("Arrivals", node_title, "by length of stay"))
    
    return(list(Node = nodeData, Purpose = purposeData, Length = lengthData, Title = titles))
  })

  # Handle events
  observe({
    session$sendCustomMessage("slider-range", sliderRange())
  })
  observe({
    session$sendCustomMessage("data", updateMapData())
  })
  observe({
    session$sendCustomMessage("scrollbar", updateScrollbarSeries())
  })
  observe({
    session$sendCustomMessage("charts", updateCharts())
  })
  output$header <- renderText({
    last_node <- input$last_node
    if (is.null(input$last_node)) {
      last_node <- "New Zealand"
    }
  	paste("Visitor arrivals ✈️", 
  	      ifelse(last_node %in% levels(va$NZ_port), "to", "from"), 
  	      last_node)
  })
}

shinyApp(ui, server)