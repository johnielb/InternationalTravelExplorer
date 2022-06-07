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
        column(4, tags$div(id = "countryChart")),
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
  interpolateWeek <- reactive({
    index <- input$week_ended
    if (is.null(input$week_ended)) {
      index <- sliderRange()+1
    }
    range <- unique(va$Week_ended)
    return(range[index])
  })

  filteredVAData <- reactive({
    va %>%
      filter(Length_of_stay == input$lengths, Travel_purpose == input$purposes) %>%
      return()
  })

  updateData <- reactive({
    week_ended <- interpolateWeek()
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
          select(To = NZ_port, Count) %>%
          group_by(To) %>%
          summarise(Count = sum(Count)) %>% 
          left_join(geo, by = c("To" = "Name"))
      ) %>%
      mutate(TimePeriod = week_ended) %>%
      toJSON() %>%
      return()
  })
  
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

  observe({
    session$sendCustomMessage("slider-range", sliderRange())
    session$sendCustomMessage("data", updateData())
    session$sendCustomMessage("scrollbar", updateScrollbarSeries())
  })
}

shinyApp(ui, server)