library(shiny)
library(jsonlite)
library(dplyr)
library(tidyr)
library(forcats)
library(stringr)
library(lubridate)
library(readr)

ui <- fluidPage(
  tags$head(
    tags$script(src = "http://www.amcharts.com/lib/4/core.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/charts.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/maps.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/themes/animated.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/geodata/worldLow.js"),
    tags$link(rel = "stylesheet", type = "text/css", href = "main.css")
  ),
  tags$script(src = "map.js"),
  titlePanel("International Travel Explorer"),
  fillPage(
    sidebarPanel(
      width = 3,
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
        class = "mapRow",
        column(12, tags$div(id = "map"))
      ),
      fluidRow(
        tableOutput("nodes")
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
  interpolateWeek <- reactive({
    index <- input$week_ended
    if (is.null(input$week_ended)) {
      index <- sliderRange()+1
    }
    range <- unique(va$Week_ended)
    return(range[index])
  })

  filteredVAData <- reactive({
    week_ended <- interpolateWeek()

    va %>%
      filter(Length_of_stay == input$lengths, Travel_purpose == input$purposes, Week_ended == week_ended) %>%
      return()
  })

  nodeData <- reactive({
    df <- filteredVAData()
    df %>%
      select(Name = Country_of_residence, Count) %>%
      group_by(Name) %>%
      summarise(Count = sum(Count)) %>%
      mutate(Type = "From") %>%
      rows_insert(
        df %>%
          select(Name = NZ_port, Count) %>%
          group_by(Name) %>%
          summarise(Count = sum(Count)) %>%
          mutate(Type = "To")
      ) %>%
      inner_join(geo, by = "Name") %>%
      mutate(TimePeriod = df$Week_ended[1]) %>%
      toJSON() %>%
      return()
  })

  edgeData <- reactive({
    nz_port <- input$port
    if (is.null(input$port)) {
      nz_port <- "New Zealand"
    }

    df <- filteredVAData()
    df %>%
      filter(NZ_port == nz_port) %>%
      select(From = Country_of_residence, To = NZ_port, Count) %>%
      # group_by(From, To) %>%
      # summarise(Count = sum(Count)) %>%
      toJSON() %>%
      return()
  })

  observe({
    session$sendCustomMessage("slider-range", sliderRange())
    session$sendCustomMessage("node-data", nodeData())
    session$sendCustomMessage("edge-data", edgeData())
  })

  # observeEvent(input$purposes, updateData)
  # observeEvent(input$length, updateData)
}

shinyApp(ui, server)