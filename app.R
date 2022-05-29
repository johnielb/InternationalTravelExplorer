library(shiny)
library(jsonlite)

ui <- fluidPage(
  tags$head(
    tags$script(src = "http://www.amcharts.com/lib/4/core.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/charts.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/maps.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/themes/animated.js"),
    tags$script(src = "http://www.amcharts.com/lib/4/geodata/worldLow.js"),
    tags$link(rel = "stylesheet", type = "text/css", href = "main.css")
    # tags$script(src = "mapBinding.js")
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
      )
    )
  )
)

server <- function(input, output){

}

shinyApp(ui, server)