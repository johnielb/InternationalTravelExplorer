# WRANGLE VISITOR ARRIVAL DATA
# Author: Johniel Bocacao
# Wrangle provisional visitor arrival comma-separated data from StatsNZ into JSON. 
# Establishes a 

# 1. Set up environment =================================
library(dplyr)
library(tidyr)
library(jsonlite)
library(forcats)
library(stringr)
library(lubridate)
library(readr)

sum_and_complete_category <- function(df) {
  df %>%
    group_by(TimePeriod, Category) %>%
    arrange(TimePeriod, Category) %>%
    summarise(Value = sum(Value)) %>%
    ungroup() %>%
    mutate(Category = fct_drop(Category)) %>% # drop unused categories before filling in below
    complete(TimePeriod, Category, fill=list(Value = 0))
}

calculate_daily_growth_vs_2019 <- function(df) {
  n_categories <- length(unique(df$Category))
  
  df_2019 <- df %>%
    head(365*n_categories) %>%
    mutate(Month = month(TimePeriod),
           Day = day(TimePeriod))
  
  df %>%
    tail(-365*n_categories) %>%
    mutate(Month = month(TimePeriod),
           Day = day(TimePeriod)) %>%
    right_join(df_2019, by=c("Category", "Month", "Day"), suffix=c("_Final","_Init")) %>%
    mutate(Growth = (Value_Final/Value_Init-1)*100) %>%
    select(TimePeriod = TimePeriod_Final, Category, Value = Growth)
}

write_utf8 <- function(string, filename) {
  con <- file(filename, "wb")
  writeBin(charToRaw(string), con, endian="little")
  close(con)
}

# 2. Load in visitor arrival (VA) data ======================================
va_last_modified <- "17Apr2022"
va_last_modified_date <- as.Date(va_last_modified, format="%d%b%Y")
va_raw <- read_csv(paste0("data/VisitorArrivals ", va_last_modified, ".csv"),
                    col_types = cols_only(Week_ended = col_date(format="%Y-%m-%d"),
                                          Country_of_residence = "f",
                                          NZ_port = "f",
                                          Length_of_stay = "f",
                                          Travel_purpose = "f",
                                          Count = "i"))
va_raw <- va_raw %>%
  rbind(read_csv("data/VisitorArrivals2019.csv",
                 col_types = cols_only(Week_ended = "D",
                                       Country_of_residence = "f",
                                       NZ_port = "f",
                                       Length_of_stay = "f",
                                       Travel_purpose = "f",
                                       Count = "i")) %>%
          filter(Week_ended < min(va_raw$Week_ended))) 

# TODO: Impute 2019-01-01 to 2019-04-14 visitor arrival data from ITM so % change can be calculated.

# 3. Wrangle visitor arrival (VA) data ======================================
va <- va_raw %>%
  filter(Country_of_residence != "Total") %>% 
  mutate(Country_of_residence = factor(Country_of_residence) %>% 
           # Drop continental data
           fct_other(drop = c("Africa and the Middle East", "Americas", "Asia",
                              "Europe", "Oceania")) %>% 
           # Truncate political stuff, easier to geocode
           fct_recode("China" = "China, People's Republic of", 
                      "Hong Kong" = "Hong Kong (Special Administrative Region)",
                      "South Korea" = "Korea, Republic of") %>% 
           fct_drop() %>% 
           fct_relevel(sort),
         NZ_port = factor(NZ_port) %>% 
           # Geocode totals as coming into New Zealand
           fct_recode("New Zealand" = "Total") %>% 
           fct_drop() %>% 
           fct_relevel(sort),
         Length_of_stay = factor(Length_of_stay) %>% 
           # Make meaningful in dropdown
           fct_recode("All lengths of stay" = "Total") %>% 
           fct_drop() %>% 
           fct_relevel(sort) %>% 
           fct_relevel("All lengths of stay"),
         Travel_purpose = factor(Travel_purpose) %>% 
           # Collapse tiny misc. categories into Other, conventions into Business
           fct_collapse("Other" = c("Other", "Not Stated", "Education"),
                        "Business" = c("Business", "Conventions/conferences")) %>%
           # Make meaningful in dropdown
           fct_recode("All purposes of travel" = "Total") %>% 
           fct_drop() %>% 
           fct_relevel(sort)
         ) %>% 
  filter(Country_of_residence != "Other", NZ_port != "Other") %>% 
  arrange(Travel_purpose, Week_ended, Country_of_residence, NZ_port)

va_nested <- va %>% 
  select(TimePeriod = Week_ended, From = Country_of_residence, To = NZ_port, 
         Purpose = Travel_purpose, Length = Length_of_stay, Value = Count) %>% 
  group_by(Purpose, Length, TimePeriod, From, To) %>% 
  summarise(Value = sum(Value)) %>%
  group_by(Purpose, Length, TimePeriod) %>% 
  nest() %>% 
  pivot_wider(names_from = "TimePeriod", values_from = "data") %>% 
  group_by(Purpose, Length) %>% 
  nest()  %>% 
  pivot_wider(names_from = "Length", values_from = "data") %>% 
  group_by(Purpose) %>% 
  nest()  %>% 
  pivot_wider(names_from = "Purpose", values_from = "data")

save(va_nested, file="data/va_nested.Rda")

va_nested %>% 
  jsonlite::toJSON() %>%
  toString() %>%
  write_utf8("data/allData.json")
