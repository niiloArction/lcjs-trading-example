import { lightningChart, emptyFill, ChartXY, LineSeries, AreaRangeSeries, OHLCSeriesTraditional, OHLCCandleStick, OHLCFigures, XOHLC, Point, AxisTickStrategies, Axis, VisibleTicks, emptyLine, transparentFill, emptyTick, transparentLine, AreaSeries, AreaSeriesTypes, ColorRGBA, Color, SolidFill } from "@arction/lcjs"

//#region ----- Application configuration -----

// To disable/enable/modify charts inside application, alter values below:

const chartConfigOHLC = {
    show: true,
    verticalSpans: 3,
    /**
     * Simple Moving Average.
     */
    sma: {
        show: true,
        averagingFrameLength: 13
    },
    /**
     * Exponential Moving Average.
     *
     * Uses same averagingFrameLength as above SMA.
     */
    ema: {
        show: true
    },
    /**
     * Bollinger Bands.
     */
    bollinger: {
        show: true,
        averagingFrameLength: 20
    }
}
const chartConfigVolume = {
    show: true,
    verticalSpans: 1
}
const chartConfigRSI = {
    show: false,
    verticalSpans: 1
}

// Market data is currently always requested and parsed from worldtradingdata.com
enum DataSources { WorldTradingData }
const dataSource = DataSources.WorldTradingData
let dataSourceApiToken: string | undefined

/**
 * Choose a DateTime origin. LCJS uses this to optimize DateTime Axis performance.
 * A good reference is value is the expected start Date of used data.
 */
const dateTimeOrigin = new Date(
    // Year
    2019,
    // Month [0, 11]
    0,
    // Day [1, 31]
    1
)

//#endregion

//#region ----- Read worldtradingdata.com API token from local file 'wtd-token.json' -----
if ( dataSource === DataSources.WorldTradingData ) {
    try {
        const tokenJSON = require('../wtd-token.json')
        dataSourceApiToken = tokenJSON.token
    } catch (e) {
        dataSourceApiToken = undefined
    }
    if ( dataSourceApiToken === undefined || dataSourceApiToken === 'demo' ) {
        console.log('No API token for worldtradingdata.com')
        const registerUrl = 'https://www.worldtradingdata.com/register'

        if ( window.confirm( `No API token for worldtradingdata.com!
Register at ${registerUrl} for free, and write your API token to file: 'wtd-token.json'` ) ) {
            // Attempt to open new tab in above webpage directly. Note that often browsers block this operation.
            window.open( registerUrl )
        }
    }
}
//#endregion

//#region ----- Find referenced DOM elements from 'index.html' -----
const domElementIDs = {
    chartContainer: 'trading-chart-container',
    dataSearchInput: 'trading-data-search-input',
    dataSearchActivate: 'trading-data-search-activate'
}
const domElements = new Map<string, HTMLElement>()
Object.keys(domElementIDs).forEach((key) => {
    const domElementID = domElementIDs[ key ]
    const domElement = document.getElementById( domElementID )
    if ( domElement === undefined )
        throw new Error( 'DOM element not found: ' + domElementID )
    domElements.set( domElementID, domElement )
})
//#endregion

//#region ----- Create Dashboard and Charts -----

//#region ----- Create Dashboard -----
const chartConfigs = [ chartConfigOHLC, chartConfigVolume, chartConfigRSI ]
/**
 * Utility function for counting the row span before a specified chart index.
 */
const countRowSpanForChart = ( chartIndex: number ) => chartConfigs.reduce(
    (sum, chartConfig, i) => sum + (chartConfig.show && i < chartIndex ? chartConfig.verticalSpans : 0),
    0
)

// Create Dashboard inside chart container div. 
const dashboard = lightningChart().Dashboard({
    containerId: domElementIDs.chartContainer,
    numberOfColumns: 1,
    // Count row span for all charts.
    numberOfRows: countRowSpanForChart( chartConfigs.length )
})
//#endregion

const xAxisTickStrategy = AxisTickStrategies.DateTime( dateTimeOrigin )
//#region ----- Create OHLC Chart -----
let chartOHLC: ChartXY | undefined
let seriesOHLC: OHLCSeriesTraditional<OHLCCandleStick, OHLCCandleStick> | undefined
let seriesSMA: LineSeries | undefined
let seriesEMA: LineSeries | undefined
let seriesBollinger: AreaRangeSeries | undefined

if ( chartConfigOHLC.show ) {
    chartOHLC = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigOHLC ) ),
        rowSpan: chartConfigOHLC.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: xAxisTickStrategy
        }
    })
        // Remove title.
        .setTitleFillStyle( emptyFill )

    if ( chartConfigOHLC.bollinger.show ) {
        // Create Bollinger Series.

    }
    if ( chartConfigOHLC.sma.show ) {
        // Create SMA Series.
        seriesSMA = chartOHLC.addLineSeries()
    }
    if ( chartConfigOHLC.ema.show ) {
        // Create EMA Series.
        seriesEMA = chartOHLC.addLineSeries()
    }
    // Create OHLC Series.
    seriesOHLC = chartOHLC.addOHLCSeries({
        positiveFigure: OHLCFigures.Candlestick,
        negativeFigure: OHLCFigures.Candlestick
    })
}
//#endregion

//#region ----- Create Volume Chart -----
let chartVolume: ChartXY | undefined
let seriesVolume: AreaSeries | undefined

if ( chartConfigVolume.show ) {
    chartVolume = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigVolume ) ),
        rowSpan: chartConfigVolume.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: xAxisTickStrategy
        }
    })
        // Remove title.
        .setTitleFillStyle( emptyFill )

    // Create Volume Series.
    seriesVolume = chartVolume.addAreaSeries({
        type: AreaSeriesTypes.Positive
    })
}
//#endregion

//#region ----- Create RSI Chart -----
let chartRSI: ChartXY | undefined
//#endregion

//#region ----- Configure Axes -----
const charts = [ chartOHLC, chartVolume, chartRSI ]
// Find lowest shown Chart index.
const lowestShownChartIndex = chartConfigs.reduce(
    (prev, chartConfig, i) => chartConfig.show ? i : prev,
    -1
)
const masterAxis = charts[ lowestShownChartIndex ].getDefaultAxisX()

// Bind X Axes together.
const HandleScaleChangeX = ( chartIndex: number ) => {
    return ( start: number, end: number ) => {
        for ( let i = 0; i < charts.length; i ++ ) {
            if ( chartConfigs[i].show ) {
                const axis = charts[ i ].getDefaultAxisX()
                if ( i !== chartIndex && axis.scale.getInnerStart() !== start && axis.scale.getInnerEnd() !== end )
                    axis.setInterval( start, end )
            }
        }
    }
}
for ( let i = 0; i < charts.length; i ++ ) {
    if ( chartConfigs[i].show ) {
        const chart = charts[i]
        chart.getDefaultAxisX()
            .setScrollStrategy( undefined )
            .onScaleChange( HandleScaleChangeX( i ) )
    }
}

// i !== j && axis.scale.getInnerStart() !== start && axis.scale.getInnerEnd() !== end

//#endregion

//#endregion

//#region ----- Implement logic for rendering supplied data -----
interface StringOHLCWithVolume {
    close: string
    high: string
    low: string
    open: string
    volume: string
}
interface AppDataFormat {
    name: string,
    /**
     * 'history' is an object whose keys are UTC Dates as Strings.
     * 
     * Each value is an OHLC value with an additional 'volume'-field.
     * Note that at this stage values are strings, not numbers! To use with LCJS they must be parsed to Numbers.
     */
    history: { [key: string]: StringOHLCWithVolume }
}
const renderOHLCData = ( data: AppDataFormat ) => {
    //#region ----- Prepare data for rendering with LCJS -----
    // Map values to LCJS accepted format, where the date is formatted to a Number.
    const xohlcValues: XOHLC[] = []
    // Separate Volume values from OHLC.
    const volumeValues: Point[] = []

    // Measure operation time.
    const tStart = window.performance.now()

    // Get starting Date from first item.
    const dataKeys = Object.keys( data.history )
    // DateTime values must be subtracted 'dateTimeOrigin' for Axes to show Date values correctly.
    const dateTimeOriginTime = dateTimeOrigin.getTime()

    const dataKeysLen = dataKeys.length
    for ( let i = 0; i < dataKeysLen; i ++ ) {
        const key = dataKeys[ i ]
        const stringValues = data.history[ key ]
        // Date-key is UTC, and can be directly transformed to Date.
        const x = new Date( key ).getTime() - dateTimeOriginTime
        const o = Number( stringValues.open )
        const h = Number( stringValues.high )
        const l = Number( stringValues.low )
        const c = Number( stringValues.close )
        const volume = Number( stringValues.volume )

        xohlcValues.push([x, o, h, l, c])
        volumeValues.push({ x, y: volume })
    }
    console.log(`Prepared data in ${((window.performance.now() - tStart) / 1000).toFixed(1)} s`)
    console.log(`${xohlcValues.length} XOHLC values, ${volumeValues.length} Volume values.`)
    //#endregion

    //#region ----- Render data -----
    //#region OHLC.
    if ( seriesOHLC ) {
        seriesOHLC
            .clear()
            .add( xohlcValues )
    }
    //#endregion

    //#region SMA.
    if ( seriesSMA ) {
        // Compute SMA values from XOHLC values using data-analysis library.
        const smaValues = calculateSimpleMovingAverage( xohlcValues, chartConfigOHLC.sma.averagingFrameLength )
        seriesSMA
            .clear()
            .add( smaValues )
    }
    //#endregion

    //#region EMA.
    if ( seriesEMA ) {
        // Compute EMA values from XOHLC values using data-analysis library.
        const emaValues = calculateExponentialMovingAverage( xohlcValues, chartConfigOHLC.sma.averagingFrameLength )
        seriesEMA
            .clear()
            .add( emaValues )
    }
    //#endregion

    //#region Bollinger.
    
    //#endregion

    //#region Volume
    if ( seriesVolume ) {
        // To render Volume values as Histogram bars, map 'volumeValues' and add step values between data-points.
        const histogramBarValues: Point[] = []
        let prev: Point | undefined
        const len = volumeValues.length
        for ( let i = 0; i < len; i ++ ) {
            const cur = volumeValues[ i ]
            // Add step between previous value and cur value.
            if ( prev ) {
                histogramBarValues.push( { x: prev.x, y: cur.y } )
            }
            histogramBarValues.push( cur )
            prev = cur
        }

        seriesVolume
            .clear()
            .add( histogramBarValues )
    }
    //#endregion

    //#region RSI.

    //#endregion

    //#endregion

    // Fit new data to X view (automatic X scrolling is disabled in application).
    masterAxis.fit()
}

//#endregion

//#region ----- Subscribe to data-search events for searching and rendering data -----

// Function that handles event where data search failed.
const dataSearchFailed = ( searchSymbol: string ) => {
    console.log('No data found for \'', searchSymbol, '\'')
}

// Define function that searches OHLC data.
const searchData = ( searchSymbol: string ) => {
    if ( dataSource === DataSources.WorldTradingData ) {
        // Use worldtradingdata.com API.
        console.log('Requesting worldtradingdata.com for \'' + searchSymbol + '\'')
        /**
         * Symbol to search.
         */
        const symbol: string = searchSymbol
        /**
         * Free worldtradingdata.com API Token.
         */
        const apiToken: 'demo' | string = dataSourceApiToken
        /**
         * Start date of data retrieval.
         *
         * YYYY-MM-DD
         */
        const date_from: string = '2019-01-01'
        /**
         * Sorting basis.
         */
        const sort: 'asc' | 'desc' | 'newest' | 'oldest' = 'asc'

        fetch(`https://www.worldtradingdata.com/api/v1/history?symbol=${symbol}&date_from=${date_from}&sort=${sort}&api_token=${apiToken}`)
            // It would seem that worldtradingdata.com doesn't set response.ok flag when requested stock is not found.    
            // .then((response) => {
            //     if (! response.ok)
            //         dataSearchFailed( searchSymbol )
            //     else
            //         return response
            // })
            .then((response) => response.json())
            .then((data: AppDataFormat) => {
                // Check for static error message.
                if ( 'Message' in data ) {
                    // Assume error message.
                    dataSearchFailed( searchSymbol )
                } else {
                    console.log('Received data from worldtradingdata.com')
                    console.log(data)
    
                    renderOHLCData(data)
                }
            })
    }
    else
        throw new Error('Unknown data source.')
}

// Subscribe to event when data-search is activated.
domElements.get( domElementIDs.dataSearchActivate )
    .addEventListener('click', (event: MouseEvent) => {
        // Get search symbol from input field.
        const inputField = domElements.get( domElementIDs.dataSearchInput ) as HTMLInputElement
        const searchSymbol = inputField.value
        searchData( searchSymbol )
    })

//#endregion

//#region ----- Data analysis tools TO BE MOVED TO NPM LIB -----
/**
 * Calculate SMA values from XOHLC values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Array of SMA values. Length of this array is 'averagingFrameLength' - 1 less than 'xohlcValues'
 */
const calculateSimpleMovingAverage = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const yValueBuffer: number[] = []
    let sum = 0

    for ( let i = 0; i < len; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for SMA.
        const value = xohlc[4]
        sum += value
        if ( i >= averagingFrameLength - 1 ) {
            // Append current average.
            const curAvg = sum / averagingFrameLength
            result.push({ x: xohlc[0], y: curAvg})
            // Drop oldest points value.
            const droppedValue = yValueBuffer.shift()
            sum -= droppedValue
        }
        yValueBuffer.push(value)
    }
    return result
}
/**
 * Calculate EMA values from SMA values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Array of EMA values.  Length of this array is equal to xohlcValues.length - averagingFrameLength + 1
 */
const calculateExponentialMovingAverage = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const weighingMultiplier = 2 / ( averagingFrameLength + 1 )

    // Calculate initial previous EMA using SMA method.
    let previousEMA: number = 0
    let i
    for ( i = 0; i < averagingFrameLength; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for SMA.
        const value = xohlc[4]
        previousEMA += value / averagingFrameLength
    }
    for ( ; i < len; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for EMA.
        const value = xohlc[4]
        // Compute current EMA value.
        const ema = value * weighingMultiplier + ( previousEMA !== undefined ? previousEMA * (1 - weighingMultiplier) : 0 )
        if ( i >= averagingFrameLength - 1 ) {
            result.push({ x: xohlc[0], y: ema })
        }
        previousEMA = ema
    }
    return result
}


//#endregion

//#region ----- Style application -----
enum AppColor {
    LightBlue,
    Purplish
}
const colors = new Map<AppColor, Color>()
colors.set( AppColor.LightBlue, ColorRGBA( 162, 191, 244 ) )
colors.set( AppColor.Purplish, ColorRGBA( 209, 44, 144 ) )


const solidFills = new Map<AppColor, SolidFill>()
colors.forEach((color, key) => solidFills.set( key, new SolidFill({ color }) ))

// Add top padding to very first Chart, so nothing is hidden by data-search input.
charts[0].setPadding({ top: 30 })

// Style Axes.
for ( let i = 0; i < charts.length; i ++ ) {
    const chart = charts[i]
    if ( chart !== undefined ) {
        const axisX = chart.getDefaultAxisX()
        const axisY = chart.getDefaultAxisY()
        const isChartWithMasterAxis = axisX === masterAxis

        if ( ! isChartWithMasterAxis ) {
            // This Charts X Axis will be hidden, and configured to scroll according to the master Axis.
            axisX
                .setTickStyle(emptyTick)
                .setStrokeStyle( emptyLine )
                // TODO: Why cant Nibs be hidden?
                .setNibStyle( <any>emptyLine )
                // Disable scrolling.
                .setScrollStrategy( undefined )
                // Disable mouse interactions on hidden Axes.
                .setMouseInteractions( false )
                
        } else {
            // This Chart has the Master Axis.
            axisX
                .setTickStyle((ticks: VisibleTicks) => ticks
                    // Hide GridLines, but keep ticks.
                    .setGridStrokeStyle( transparentLine )
                )
        }
    }
}

// Style Series.
if ( seriesSMA )
    seriesSMA
        .setStrokeStyle(( solidLine ) => solidLine
            .setFillStyle( solidFills.get( AppColor.Purplish ) )
        )

if ( seriesEMA )
    seriesEMA
        .setStrokeStyle(( solidLine ) => solidLine
            .setFillStyle( solidFills.get( AppColor.LightBlue ) )
        )

// TODO: ResultTableFormatters.

//#endregion



// Development configuration.
;(<HTMLInputElement>domElements.get( domElementIDs.dataSearchInput )).value = 'AAPL'

