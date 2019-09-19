import { lightningChart, emptyFill, ChartXY, LineSeries, AreaRangeSeries, OHLCSeriesTraditional, OHLCCandleStick, OHLCFigures, XOHLC, Point, AxisTickStrategies, Axis, VisibleTicks, emptyLine, transparentFill, emptyTick, transparentLine, AreaSeries, AreaSeriesTypes, ColorRGBA, Color, SolidFill, AreaPoint, SolidLine, DataPatterns, MarkerBuilders, UIElementBuilders, CustomTick, ColorHEX, UITextBox, UIOrigins, TableContentBuilder, SeriesXY, RangeSeriesFormatter, SeriesXYFormatter, AutoCursorXY, AreaSeriesPositive, UIDraggingModes } from "@arction/lcjs"

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
        averagingFrameLength: 13
    }
}
const chartConfigVolume = {
    show: true,
    verticalSpans: 1
}
const chartConfigRSI = {
    show: true,
    verticalSpans: 1,
    averagingFrameLength: 13
}

// Market data is currently always requested and parsed from worldtradingdata.com
enum DataSources { WorldTradingData }
const dataSource = DataSources.WorldTradingData
let dataSourceApiToken: string | undefined

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

// Create custom X tick strategy for indexed Date values. Object must fulfill interface: AxisTickStrategy.
let dateTimeFormatter
const dateTimeTickStrategy = {
    computeMinimalPrecision: AxisTickStrategies.Numeric.computeMinimalPrecision,
    formatValue: ( x: number ) => dateTimeFormatter.format( getDateFromIndex( Math.round( x ) ) )
}
// Builder for CustomTicks ticks with no Background.
let tickWithoutBackgroundBuilder = UIElementBuilders.PointableTextBox
    .addStyler(( pointableTextBox ) => pointableTextBox
        .setBackground(( background ) => background
            .setFillStyle( emptyFill )
            .setStrokeStyle( emptyLine )
            .setPointerLength( 0 )
        )
    )

//#region ----- Create OHLC Chart -----
let chartOHLC: ChartXY | undefined
let seriesOHLC: OHLCSeriesTraditional<OHLCCandleStick, OHLCCandleStick> | undefined
let seriesSMA: LineSeries | undefined
let seriesEMA: LineSeries | undefined
let seriesBollinger: AreaRangeSeries | undefined
let chartOHLCTitle: UITextBox | undefined

if ( chartConfigOHLC.show ) {
    chartOHLC = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigOHLC ) ),
        rowSpan: chartConfigOHLC.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: dateTimeTickStrategy
        }
    })
    
    // Create custom title attached to the top of Y Axis.
    const axisX = chartOHLC.getDefaultAxisX()
    const axisY = chartOHLC.getDefaultAxisY()
    const _chartOHLCTitle = chartOHLC.addUIElement(
        UIElementBuilders.TextBox,
        {
            x: axisX.scale,
            y: axisY.scale
        }
    )
        .setText( '' )
        .setPosition({ x: 0, y: 10 })
        .setOrigin( UIOrigins.LeftTop )
        .setDraggingMode( UIDraggingModes.notDraggable )
    chartOHLCTitle = _chartOHLCTitle
    // Follow Axis interval changes to keep title positioned where it should be.
    axisX.onScaleChange((start, end) => _chartOHLCTitle.setPosition({ x: start, y: axisY.scale.getInnerEnd() }))
    axisY.onScaleChange((start, end) => _chartOHLCTitle.setPosition({ x: axisX.scale.getInnerStart(), y: end }))

    if ( chartConfigOHLC.bollinger.show ) {
        // Create Bollinger Series.
        seriesBollinger = chartOHLC.addAreaRangeSeries()
            .setName( 'Bollinger Band' )
            // Disable data-cleaning.
            .setMaxPointCount( undefined )
            // Disable cursor interpolation.
            .setCursorInterpolationEnabled( false )
    }
    if ( chartConfigOHLC.sma.show ) {
        // Create SMA Series.
        seriesSMA = chartOHLC.addLineSeries({
            dataPattern: DataPatterns.horizontalProgressive
        })
            .setName( 'SMA' )
            // Disable data-cleaning.
            .setMaxPointCount( undefined )
            // Disable cursor interpolation.
            .setCursorInterpolationEnabled( false )
    }
    if ( chartConfigOHLC.ema.show ) {
        // Create EMA Series.
        seriesEMA = chartOHLC.addLineSeries({
            dataPattern: DataPatterns.horizontalProgressive
        })
            .setName( 'EMA' )
            // Disable data-cleaning.
            .setMaxPointCount( undefined )
            // Disable cursor interpolation.
            .setCursorInterpolationEnabled( false )
    }
    // Create OHLC Series.
    seriesOHLC = chartOHLC.addOHLCSeries({
        positiveFigure: OHLCFigures.Candlestick,
        negativeFigure: OHLCFigures.Candlestick
    })
        .setName( 'OHLC' )
        // Disable data-cleaning.
        .setMaxPointsCount( undefined )
}
//#endregion

//#region ----- Create Volume Chart -----
let chartVolume: ChartXY | undefined
let seriesVolume: AreaSeriesPositive | undefined
let chartVolumeTitle: UITextBox | undefined

if ( chartConfigVolume.show ) {
    chartVolume = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigVolume ) ),
        rowSpan: chartConfigVolume.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: dateTimeTickStrategy,
            // Volume data has a lot of quantity, so better select Units (K, M, etc.).
            defaultAxisYTickStrategy: AxisTickStrategies.NumericWithUnits
        }
    })

    // Create custom title attached to the top of Y Axis.
    const axisX = chartVolume.getDefaultAxisX()
    const axisY = chartVolume.getDefaultAxisY()
    const _chartVolumeTitle = chartVolume.addUIElement(
        UIElementBuilders.TextBox,
        {
            x: axisX.scale,
            y: axisY.scale
        }
    )
        .setText( 'Volume' )
        .setPosition({ x: 0, y: 10 })
        .setOrigin( UIOrigins.LeftTop )
        .setDraggingMode( UIDraggingModes.notDraggable )
    chartVolumeTitle = _chartVolumeTitle
    // Follow Axis interval changes to keep title positioned where it should be.
    axisX.onScaleChange((start, end) => _chartVolumeTitle.setPosition({ x: start, y: axisY.scale.getInnerEnd() }))
    axisY.onScaleChange((start, end) => _chartVolumeTitle.setPosition({ x: axisX.scale.getInnerStart(), y: end }))

    // Create Volume Series.
    seriesVolume = chartVolume.addAreaSeries({
        type: AreaSeriesTypes.Positive
    })
        .setName( 'Volume' )
        // Disable data-cleaning.
        .setMaxPointCount( undefined )
        // Disable cursor interpolation.
        .setCursorInterpolationEnabled( false )
}
//#endregion

//#region ----- Create RSI Chart -----
let chartRSI: ChartXY | undefined
let seriesRSI: LineSeries | undefined
let chartRSITitle: UITextBox | undefined
let ticksRSI: CustomTick[] = []
let tickRSIThresholdLow: CustomTick | undefined
let tickRSIThresholdHigh: CustomTick | undefined

if ( chartConfigRSI.show ) {
    chartRSI = dashboard.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: countRowSpanForChart( chartConfigs.indexOf( chartConfigRSI ) ),
        rowSpan: chartConfigRSI.verticalSpans,
        chartXYOptions: {
            defaultAxisXTickStrategy: dateTimeTickStrategy
        }
    })

    // Create custom title attached to the top of Y Axis.
    const axisX = chartRSI.getDefaultAxisX()
    const axisY = chartRSI.getDefaultAxisY()
    const _chartRSITitle = chartRSI.addUIElement(
        UIElementBuilders.TextBox,
        {
            x: axisX.scale,
            y: axisY.scale
        }
    )
        .setText( 'RSI' )
        .setPosition({ x: 0, y: 10 })
        .setOrigin( UIOrigins.LeftTop )
        .setDraggingMode( UIDraggingModes.notDraggable )
        chartRSITitle = _chartRSITitle
    // Follow Axis interval changes to keep title positioned where it should be.
    axisX.onScaleChange((start, end) => _chartRSITitle.setPosition({ x: start, y: axisY.scale.getInnerEnd() }))
    axisY.onScaleChange((start, end) => _chartRSITitle.setPosition({ x: axisX.scale.getInnerStart(), y: end }))

    // Create RSI Series.
    seriesRSI = chartRSI.addLineSeries({
        dataPattern: DataPatterns.horizontalProgressive
    })
        .setName( 'RSI' )
        // Disable data-cleaning.
        .setMaxPointCount( undefined )
        // Disable cursor interpolation.
        .setCursorInterpolationEnabled( false )

    // Create RSI ticks with CustomTicks, to better indicate common thresholds of 30% and 70%.
    axisY
        .setTickStyle( emptyTick )
        // RSI interval always from 0 to 100.
        .setInterval( 0, 100 )
        .setScrollStrategy( undefined )

    // TODO: What is this TypeScript error? This should be the right builder.
    ticksRSI.push( axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 0 )
        // Disable gridline.
        .setGridStrokeLength( 0 )
    )
    // TODO: What is this TypeScript error? This should be the right builder.
    ticksRSI.push( axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 100 )
        // Disable gridline.
        .setGridStrokeLength( 0 )
    )
    // TODO: What is this TypeScript error? This should be the right builder.
    tickRSIThresholdLow = axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 30 )
    ticksRSI.push( tickRSIThresholdLow )
    // TODO: What is this TypeScript error? This should be the right builder.
    tickRSIThresholdHigh = axisY.addCustomTick( <any>tickWithoutBackgroundBuilder )
        .setValue( 70 )
    ticksRSI.push( tickRSIThresholdHigh )
}
//#endregion

//#region ----- Configure Axes -----
const charts = [ chartOHLC, chartVolume, chartRSI ]
const chartTitles = [ chartOHLCTitle, chartVolumeTitle, chartRSITitle ]
// Find lowest shown Chart index.
const lowestShownChartIndex = chartConfigs.reduce(
    (prev, chartConfig, i) => chartConfig.show ? i : prev,
    -1
)
// Find highest shown Chart index.
const highestShownChartIndex = chartConfigs.reduce(
    (prev, chartConfig, i) => chartConfig.show ? Math.min( i, prev ) : prev,
    Number.MAX_SAFE_INTEGER
)
const masterAxis = charts[ lowestShownChartIndex ].getDefaultAxisX()

// Bind X Axes together.
const HandleScaleChangeX = ( chartIndex: number ) => {
    return ( start: number, end: number ) => {
        for ( let i = 0; i < charts.length; i ++ ) {
            if ( chartConfigs[i].show ) {
                const axis = charts[ i ].getDefaultAxisX()
                if ( i !== chartIndex && (axis.scale.getInnerStart() !== start || axis.scale.getInnerEnd() !== end) )
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
// Function which gets Date from indexed X coordinate.
let getDateFromIndex: ( x: number ) => Date = ( x ) => undefined

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
    // Map values to LCJS accepted format, with an additional X value.
    const xohlcValues: XOHLC[] = []
    // Separate Volume values from OHLC.
    const volumeValues: Point[] = []

    // Measure operation time.
    const tStart = window.performance.now()

    // Get starting Date from first item.
    const dataKeys = Object.keys( data.history )
    const dataKeysLen = dataKeys.length
    // Index data-values starting from X = 0.
    for ( let x = 0; x < dataKeysLen; x ++ ) {
        const key = dataKeys[ x ]
        const stringValues = data.history[ key ]
        const o = Number( stringValues.open )
        const h = Number( stringValues.high )
        const l = Number( stringValues.low )
        const c = Number( stringValues.close )
        const volume = Number( stringValues.volume )

        xohlcValues.push([x, o, h, l, c])
        volumeValues.push({ x, y: volume })
    }
    const xohlcValuesLen = xohlcValues.length
    const volumeValuesLen = volumeValues.length
    //#endregion 38

    // Define getDateFromIndex function.
    getDateFromIndex = ( x ) => {
        // Get Date directly from data.
        if ( x in dataKeys )
            return new Date( dataKeys[ x ] )
        else
            return undefined
    }

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
        const smaValues = simpleMovingAverage( xohlcValues, chartConfigOHLC.sma.averagingFrameLength )
        seriesSMA
            .clear()
            .add( smaValues )
    }
    //#endregion

    //#region EMA.
    if ( seriesEMA ) {
        // Compute EMA values from XOHLC values using data-analysis library.
        const emaValues = exponentialMovingAverage( xohlcValues, chartConfigOHLC.sma.averagingFrameLength )
        seriesEMA
            .clear()
            .add( emaValues )
    }
    //#endregion

    //#region Bollinger.
    if ( seriesBollinger ) {
        // Compute Bollinger bands points.
        const bollingerBandPoints = bollingerBands( xohlcValues, chartConfigOHLC.bollinger.averagingFrameLength )
        seriesBollinger
            .clear()
            .add( bollingerBandPoints )
    }
    //#endregion

    //#region Volume
    if ( seriesVolume ) {
        // To render Volume values as Histogram bars, map 'volumeValues' and add step values between data-points.
        const histogramBarValues: Point[] = []
        let prev: Point | undefined
        for ( let i = 0; i < volumeValuesLen; i ++ ) {
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
    if ( seriesRSI ) {
        // Compute RSI values from XOHLC values using data-analysis library.
        const rsiValues = relativeStrengthIndex( xohlcValues, chartConfigRSI.averagingFrameLength )
        seriesRSI
            .clear()
            .add( rsiValues )
    }
    //#endregion
    console.log(`Prepared data in ${((window.performance.now() - tStart) / 1000).toFixed(1)} s`)
    console.log(`${xohlcValuesLen} XOHLC values, ${volumeValuesLen} Volume values.`)

    // Fit new data to X view (automatic X scrolling is disabled in application).
    masterAxis.fit()

    // Set title of OHLC Chart to show name data.
    if ( chartOHLCTitle )
        chartOHLCTitle.setText( `${data.name} (1 year)` )
    // Also set name of OHLC Series.
    if ( seriesOHLC )
        seriesOHLC.setName( data.name )

    // ----- Add CustomTicks on to of default DateTime Ticks to indicate relevant dates -----
    const startOfMonthFormatter = new Intl.DateTimeFormat( undefined, { month: 'short' } )

    let prevMonth: number | undefined
    for ( let x = 0; x < dataKeysLen; x ++ ) {
        const date = getDateFromIndex( x )
        const month = date.getMonth()
        if ( prevMonth === undefined || month !== prevMonth ) {
            // Start of Month tick.
            // TODO: What is this error? It should be correct builder type.
            masterAxis.addCustomTick( <any>tickWithoutBackgroundBuilder )
                .setValue( x )
                // No gridlines.
                .setGridStrokeLength( 0 )
                // Custom formatting.
                .setTextFormatter(( x ) => startOfMonthFormatter.format( getDateFromIndex( Math.round( x ) ) ))
            prevMonth = month
        }
    }

}

//#endregion

//#region ----- REST logic for fetching data -----

const maxAveragingFrameLength = Math.max(
    chartConfigOHLC.sma.averagingFrameLength,
    chartConfigOHLC.bollinger.averagingFrameLength,
    chartConfigRSI.averagingFrameLength
)

// Function that handles event where data search failed.
const dataSearchFailed = ( searchSymbol: string ) => {
    console.log('No data found for \'', searchSymbol, '\'')
    // Set title of OHLC Chart to show no data was found.
    if ( chartOHLCTitle )
        chartOHLCTitle.setText( 'No data found for \'' + searchSymbol + '\'' )
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
        let date_from: string
        const now = new Date()
        const nBack = new Date(
            now.getTime() +
            // 1 Year.
            ( -1 * 365 * 24 * 60 * 60 * 1000 ) +
            // Load extra data based on averagingFrameLength.
            ( -2 * maxAveragingFrameLength * 24 * 60 * 60 * 1000 )
        )
        const year = nBack.getUTCFullYear()
        const month = nBack.getUTCMonth() + 1
        const date = nBack.getUTCDate()
        date_from = `${year}-${month >= 10 ? '' : 0}${month}-${date >= 10 ? '' : 0}${date}`
        console.log('Data from',date_from)
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
 * Calculate SMA values from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Array of SMA values. Length of this array is 'averagingFrameLength' - 1 less than 'xohlcValues'
 */
const simpleMovingAverage = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
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
 * Calculate EMA values from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Array of EMA values.  Length of this array is equal to xohlcValues.length - averagingFrameLength + 1
 */
const exponentialMovingAverage = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const weighingMultiplier = 2 / ( averagingFrameLength + 1 )

    // Calculate initial previous EMA using SMA method.
    let i
    let previousEMASum = 0
    for ( i = 0; i < averagingFrameLength; i ++ ) {
        const xohlc = xohlcValues[i]
        // Use 'close' value for SMA.
        const value = xohlc[4]
        previousEMASum += value
    }
    let previousEMA: number = previousEMASum / averagingFrameLength
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
/**
 * Calculate standard deviation for a set of values.
 * @param   values                  Array of values.
 * @return                          Standard deviation value.
 */
const standardDeviation = ( values: number[] ): number => {
    const len = values.length
    // Calculate average.
    let sum = 0
    for ( let i = 0; i < len; i ++ ) {
        sum += values[i]
    }
    const avg = sum / len
    //
    let sumSqDiff = 0
    for ( let i = 0; i < len; i ++ ) {
        const value = values[i]
        sumSqDiff += ( value - avg ) * ( value - avg )
    }
    return Math.sqrt( sumSqDiff / len )
}
/**
 * Calculate bollinger bands values from XOHLC values.
 * Uses "typical prices" (average of close + low + high).
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Points of Bollinger bands (X + 2 Y values)
 */
const bollingerBands = ( xohlcValues: XOHLC[], averagingFrameLength: number  ): AreaPoint[] => {
    const len = xohlcValues.length
    // Compute simple moving average.
    const smaValues = simpleMovingAverage( xohlcValues, averagingFrameLength )
    // Map 'xohlcValues' into "typical prices" (Close + Low + High) / 3.
    const typicalPrices: number[] = []
    for ( let i = 0; i < len; i ++ ) {
        const xohlc = xohlcValues[ i ]
        typicalPrices[ i ] = ( xohlc[4] + xohlc[3] + xohlc[2] ) / 3
    }
    // Compute Bollinger bands (two y values per one X value).
    const bollingerBands: AreaPoint[] = []
    for ( let i = averagingFrameLength - 1; i < len; i ++ ) {
        // Compute standard deviation over previous 'averagingFrameLength' typical prices.
        const valuesForSD = typicalPrices.slice( i - (averagingFrameLength - 1), i + 1 )
        const standardDeviation2 = 2 * standardDeviation( valuesForSD )
        // Add + and - deviation from SMA.
        const sma = smaValues[ i - (averagingFrameLength - 1) ]
        bollingerBands.push({
            position: sma.x,
            high: sma.y + standardDeviation2,
            low: sma.y - standardDeviation2
        })
    }
    return bollingerBands
}

/**
 * Calculate RSI values from XOHLC 'close' values.
 * @param   xohlcValues             Array of XOHLC values.
 * @param   averagingFrameLength    Length of averaging frame.
 * @return                          Relative Strength Index values.
 *                                  Length of this array is equal to xohlcValues.length - averagingFrameLength + 1
 */
const relativeStrengthIndex = ( xohlcValues: XOHLC[], averagingFrameLength: number ): Point[] => {
    const len = xohlcValues.length
    const result: Point[] = []
    const upValues: number[] = []
    const downValues: number[] = []
    let prevValue: number | undefined
    for ( let i = 0; i < len; i ++ ) {
        // Use close value for RSI.
        const value = xohlcValues[i][4]
        if ( prevValue !== undefined ) {
            const diff = value - prevValue
            if ( diff > 0 ) {
                upValues[i] = diff
                downValues[i] = 0
            } else {
                downValues[i] = -diff   // Use positive value
                upValues[i] = 0
            }
        }
        //don't put anything to up and dn first item. It's not used 
        prevValue = value
    }
    for ( let i = averagingFrameLength; i < len; i ++ ) {
        let avgUpSum = 0
        let avgDownSum = 0
        let count = 0
        for ( let j = i; j > i - averagingFrameLength; j-- ) {
            avgUpSum += upValues[ j ]
            avgDownSum += downValues[ j ]
            count ++
        }
        const avgUp = avgUpSum / count
        const avgDown = avgDownSum / count
        const rsi = 100 - ( 100 / ( 1 + avgUp / avgDown ) )
        result.push({ x: xohlcValues[i][0], y: rsi })
    }
    return result
}


//#endregion

//#region ----- Style application -----
// Manage Colors and derived Styles using Enums and Maps.
enum AppColor {
    White,
    LightBlue,
    Blue,
    BlueTransparent,
    DarkBlue,
    DarkerBlue,
    Purplish,
    Red,
    RedTransparent,
    Green,
    GreenTransparent
}
const colors = new Map<AppColor, Color>()
colors.set( AppColor.White, ColorHEX('#FFF') )
colors.set( AppColor.LightBlue, ColorRGBA( 162, 191, 244 ) )
colors.set( AppColor.Blue, ColorRGBA( 75, 99, 143 ) )
colors.set( AppColor.BlueTransparent, colors.get( AppColor.Blue ).setA(120) )
colors.set( AppColor.DarkBlue, ColorRGBA( 15, 23, 36 ) )
colors.set( AppColor.DarkerBlue, ColorRGBA( 10, 15, 24 ) )
colors.set( AppColor.Purplish, ColorRGBA( 209, 44, 144 ) )
colors.set( AppColor.Red, ColorRGBA( 219, 40, 68 ) )
colors.set( AppColor.RedTransparent, colors.get( AppColor.Red ).setA(120) )
colors.set( AppColor.Green, ColorRGBA( 28, 231, 69 ) )
colors.set( AppColor.GreenTransparent, colors.get( AppColor.Green ).setA(120) )


const solidFills = new Map<AppColor, SolidFill>()
colors.forEach((color, key) => solidFills.set( key, new SolidFill({ color }) ))

enum AppLineThickness { Thin, Thick }
const solidLines = new Map<AppColor, Map<AppLineThickness, SolidLine>>()
colors.forEach((_, key) => {
    const thicknessMap = new Map()
    thicknessMap.set( AppLineThickness.Thin, new SolidLine({ thickness: 2, fillStyle: solidFills.get( key ) }) )
    thicknessMap.set( AppLineThickness.Thick, new SolidLine({ thickness: 4, fillStyle: solidFills.get( key ) }) )
    solidLines.set( key, thicknessMap )
})

// Style Dashboard.
// TODO: No API for styling Dashboard splitter color?

// Style Charts.
for ( let i = 0; i < charts.length; i ++ ) {
    const chart = charts[i]
    if ( chart ) {
        chart
            // No default titles.
            .setTitleFillStyle( emptyFill )
            .setTitleMarginTop( 0 )
            .setTitleMarginBottom( 0 )
            .setPadding({ top: 10, left: 0 })
            // Color scheme.
            .setBackgroundFillStyle( solidFills.get( AppColor.DarkerBlue ) )
            .setChartBackgroundFillStyle( solidFills.get( AppColor.DarkBlue ) )
    }
}
for ( const title of chartTitles )
    if ( title )
        title
            .setTextFillStyle( solidFills.get( AppColor.Blue ) )

// Push all charts left sides equal distance away from left border.
// TODO: Is there any way to do this without adding invisible custom ticks?
for ( const chart of charts )
    if ( chart )
        chart.getDefaultAxisY().addCustomTick()
            .setMarker(( marker ) => marker
                .setPointerLength( 0 )
                .setTextFillStyle( emptyFill )
                // Padding is used to control distance.
                .setPadding({ left: 60 })
            )
            .setGridStrokeLength( 0 )

// Add top padding to very first Chart, so nothing is hidden by data-search input.
charts[0].setPadding({ top: 30 })

// Style Axes.
for ( let i = 0; i < charts.length; i ++ ) {
    const chart = charts[i]
    if ( chart !== undefined ) {
        const axisX = chart.getDefaultAxisX()
        const axisY = chart.getDefaultAxisY()
        const axes = [ axisX, axisY ]
        const isChartWithMasterAxis = axisX === masterAxis

        for ( const axis of axes ) { 
            const tickStyle = axis.getTickStyle()
            if ( tickStyle !== emptyTick )
                axis
                    .setTickStyle((tickStyle: VisibleTicks) => tickStyle
                        .setLabelFillStyle( solidFills.get( AppColor.LightBlue ) )
                        .setTickStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
                    )
            axis
                .setStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thick ) )
                .setNibStyle( solidLines.get( AppColor.Red ).get( AppLineThickness.Thick ) )
        }
        axisX
            .setTickStyle(emptyTick)

        if ( ! isChartWithMasterAxis ) {
            // This Charts X Axis is configured to scroll according to the master Axis.
            axisX
                // Disable scrolling.
                .setScrollStrategy( undefined )
                // Disable mouse interactions on hidden Axes.
                .setMouseInteractions( false )
                .setStrokeStyle( emptyLine )
                // TODO: Why cant Nibs be hidden?
                .setNibStyle( <any>emptyLine )
        }
    }
}
for ( const tick of ticksRSI )
    tick
        .setMarker(( marker ) => marker
            .setTextFillStyle( solidFills.get( AppColor.LightBlue ) )
        )
// Style CustomTicks created when rendering.
tickWithoutBackgroundBuilder = tickWithoutBackgroundBuilder.addStyler(( tick ) => tick
    .setTextFillStyle( solidFills.get( AppColor.LightBlue ) )
)

// Style Series.
if ( seriesOHLC )
    seriesOHLC
        .setPositiveStyle((candlestick) => candlestick
            .setBodyFillStyle( solidFills.get( AppColor.Green ) )
            .setStrokeStyle( solidLines.get( AppColor.Green ).get( AppLineThickness.Thin ) )
        )
        .setNegativeStyle((candlestick) => candlestick
            .setBodyFillStyle( solidFills.get( AppColor.Red ) )
            .setStrokeStyle( solidLines.get( AppColor.Red ).get( AppLineThickness.Thin ) )
        )
        .setFigureWidth( 10 )

if ( seriesSMA )
    seriesSMA
        .setStrokeStyle( solidLines.get( AppColor.Purplish ).get( AppLineThickness.Thin ) )
if ( seriesEMA )
    seriesEMA
        .setStrokeStyle( solidLines.get( AppColor.LightBlue ).get( AppLineThickness.Thin ) )
if ( seriesBollinger )
    seriesBollinger
        .setHighFillStyle( solidFills.get( AppColor.BlueTransparent ) )
        .setLowFillStyle( solidFills.get( AppColor.BlueTransparent ) )
        .setHighStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
        .setLowStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
if ( seriesVolume )
    seriesVolume
        .setFillStyle( solidFills.get( AppColor.LightBlue ) )
        .setStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
if ( seriesRSI )
    seriesRSI
        .setStrokeStyle( solidLines.get( AppColor.White ).get( AppLineThickness.Thin ) )

// Style RSI ticks.
if ( tickRSIThresholdLow )
    tickRSIThresholdLow
        .setGridStrokeStyle( solidLines.get( AppColor.GreenTransparent ).get( AppLineThickness.Thin ) )

if ( tickRSIThresholdHigh )
tickRSIThresholdHigh
        .setGridStrokeStyle( solidLines.get( AppColor.RedTransparent ).get( AppLineThickness.Thin ) )

// Style ResultTable Formatters.
// TODO: Different formatter based on Axis zoom level.
dateTimeFormatter = new Intl.DateTimeFormat( undefined, { day: 'numeric', month: 'long', year: 'numeric' } )

const resultTableFormatter = (( tableContentBuilder, series, x, y ) => tableContentBuilder
    .addRow( dateTimeFormatter.format( getDateFromIndex( Math.round( x ) ) ) )
    .addRow( series.getName(), '', series.axisY.formatValue( y ) )
) as RangeSeriesFormatter & SeriesXYFormatter
if ( seriesSMA )
    seriesSMA.setResultTableFormatter( resultTableFormatter )
if ( seriesEMA )
    seriesEMA.setResultTableFormatter( resultTableFormatter )
if ( seriesVolume )
    seriesVolume.setResultTableFormatter( resultTableFormatter )
if ( seriesRSI )
    seriesRSI.setResultTableFormatter( resultTableFormatter )
if ( seriesOHLC )
    seriesOHLC.setResultTableFormatter(( tableContentBuilder, series, ohlcSegment ) => tableContentBuilder
        .addRow( series.getName() )
        .addRow( series.axisX.formatValue( ohlcSegment.getPosition() ) )
        .addRow( 'Open', '', series.axisY.formatValue( ohlcSegment.getOpen() ) )
        .addRow( 'High', '', series.axisY.formatValue( ohlcSegment.getHigh() ) )
        .addRow( 'Low', '', series.axisY.formatValue( ohlcSegment.getLow() ) )
        .addRow( 'Close', '', series.axisY.formatValue( ohlcSegment.getClose() ) )
    )

// Enable AutoCursor auto coloring based on picked series.
const enableAutoCursorAutoColoring = ( autoCursor: AutoCursorXY ) => autoCursor
    .setResultTableAutoTextStyle( true )
    .setTickMarkerXAutoTextStyle( true )
    .setTickMarkerYAutoTextStyle( true )
// Style AutoCursors.
const styleAutoCursor = ( autoCursor: AutoCursorXY ) => autoCursor
    .setTickMarkerX(( tickMarker ) => tickMarker
        .setBackground(( background ) => background
            .setFillStyle( solidFills.get( AppColor.DarkerBlue ) )
            .setStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
        )
    )
    .setTickMarkerY(( tickMarker ) => tickMarker
        .setBackground(( background ) => background
            .setFillStyle( solidFills.get( AppColor.DarkerBlue ) )
            .setStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
        )
    )
    .setResultTable(( resultTable ) => resultTable
        .setBackground(( background ) => background
            .setFillStyle( solidFills.get( AppColor.DarkerBlue ) )
            .setStrokeStyle( solidLines.get( AppColor.Blue ).get( AppLineThickness.Thin ) )
        )
    )

if ( chartOHLC )
    chartOHLC
        .setAutoCursor( enableAutoCursorAutoColoring )
        .setAutoCursor( styleAutoCursor )
if ( chartVolume )
    chartVolume
        .setAutoCursor( enableAutoCursorAutoColoring )
        .setAutoCursor( styleAutoCursor )
if ( chartRSI )
    chartRSI
        .setAutoCursor( enableAutoCursorAutoColoring )
        .setAutoCursor( styleAutoCursor )

if ( seriesBollinger )
    // No Cursor picking for Bollinger Bands.
    seriesBollinger
        .setMouseInteractions( false )
        .setCursorEnabled( false )

//#endregion
