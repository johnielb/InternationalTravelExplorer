library(httr)
library(dplyr)
library(stringr)

if (!exists("va_nested")) load("data/va_nested.Rda")
df <- va_nested[[1]][[1]][[1]][[1]][[2]][[1]]
countries <- df$From %>% levels() %>% magrittr::extract(. != "Other")
ports <- df$To %>% levels() %>% magrittr::extract(. != "Other")
geo <- data.frame()

for (c in c(countries, ports)) {
  encoded_c <- URLencode(c) %>% 
    str_replace_all("%20", "+")
  query <- paste0("https://nominatim.openstreetmap.org/search?q=", encoded_c, "&format=json&limit=1")
  print(query)
  resp <- GET(query) %>% content()
  geo <- rbind(geo, c(c, resp[[1]]$lat, resp[[1]]$lon))
}
names(geo) <- c("Name", "Latitude", "Longitude")

geo %>% 
  mutate(Latitude = as.numeric(Latitude), Longitude = as.numeric(Longitude)) %>% 
  jsonlite::toJSON(pretty = F) %>%
  toString() %>%
  write_utf8("data/geocodes.json")
