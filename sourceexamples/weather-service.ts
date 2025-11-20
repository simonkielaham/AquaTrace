
'use server';

import { fetchWeatherApi } from 'openmeteo';

export interface WeatherParams {
    latitude: number;
    longitude: number;
    startDate: string;
    endDate: string;
}

export async function getWeatherData(params: WeatherParams): Promise<string> {
    if (!params) {
        throw new Error("No params provided to getWeatherData.");
    }
    
    // Using the historical forecast API as it handles a wide range of dates including pseudo-future dates in sample files.
    const url = "https://historical-forecast-api.open-meteo.com/v1/forecast";

    const fetchParams = {
        "latitude": params.latitude,
        "longitude": params.longitude,
        "start_date": params.startDate.split('T')[0],
        "end_date": params.endDate.split('T')[0],
        "hourly": "precipitation,temperature_2m",
        "timezone": "America/Toronto",
    };

    try {
        const responses = await fetchWeatherApi(url, fetchParams);
        const response = responses[0];

        const utcOffsetSeconds = response.utcOffsetSeconds();
        const hourly = response.hourly();
        
        if (!hourly) {
            console.warn(`Weather Service: API response for ${params.startDate} to ${params.endDate} did not contain 'hourly' data object.`);
            return '';
        }
        
        const precipVar = hourly.variables(0);
        const tempVar = hourly.variables(1);

        if (!precipVar || !tempVar) {
            console.warn(`Weather Service: Hourly data for ${params.startDate} to ${params.endDate} did not contain expected variables.`);
            return '';
        }
        
        const precipitationData = precipVar.valuesArray();
        const temperatureData = tempVar.valuesArray();


        if (!hourly.time() || !hourly.timeEnd() || !hourly.interval() || !precipitationData || !temperatureData) {
            console.warn(`Weather Service: Incomplete data from API for ${params.startDate} to ${params.endDate}. Time, precipitation, or temperature data is missing.`);
            return '';
        }
        
        const timeArray = [...Array(Math.round((Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval()))].map(
                (_, i) => new Date((Number(hourly.time()) + i * hourly.interval()) * 1000 + (utcOffsetSeconds*1000))
        );

        let csvString = 'date,precipitation,temperature\n';
        for (let i = 0; i < timeArray.length; i++) {
            csvString += `"${timeArray[i].toISOString()}",${precipitationData[i] || 0},${temperatureData[i] || 0}\n`;
        }
        
        return csvString;

    } catch (error) {
        console.error("Weather Service Error: Failed to fetch or process weather data.", {
            url,
            params: fetchParams,
            error,
        });

        if (error instanceof Error && error.message.includes('fetch failed')) {
            throw new Error(`Network error while fetching weather data from Open-Meteo. Please check server connectivity. Details: ${error.message}`);
        }
        throw new Error(`An unexpected error occurred in the weather service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
