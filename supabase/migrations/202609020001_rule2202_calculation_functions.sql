-- ============================================================================
-- Migration: Rule 2202 Deterministic Compliance Calculation Functions
-- South Coast AQMD On-Road Motor Vehicle Mitigation Options
-- All functions are pure, deterministic PL/pgSQL arithmetic.
-- No AI/LLM calls, no external I/O, no non-deterministic inputs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: calculate_avr
-- Formula (plain notation): AVR = window_employees / window_vehicle_trips
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_avr(
    window_employees INT,
    window_vehicle_trips NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF window_vehicle_trips IS NULL OR window_vehicle_trips = 0 THEN
        RETURN NULL;
    END IF;

    IF window_employees IS NULL THEN
        RETURN NULL;
    END IF;

    -- AVR = window_employees / window_vehicle_trips
    RETURN ROUND(window_employees::NUMERIC / window_vehicle_trips, 2);
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: vehicle_trip_weight
-- Formula (plain notation): per-employee vehicle-trip divisor by commute mode
--   drive_alone            = 1
--   carpool (2-6 occ.)     = 1 / occupants
--   vanpool (7-15 occ.)    = 1 / occupants
--   shared_motorcycle      = 1 / occupants
--   transit / bus_pool / bicycle / walk / telecommute / cww_day_off / zev /
--   non_commuting          = 0
--   unrecognized mode      = 1 (treated as drive_alone)
--   NULL / missing mode    = 1 (non-response defaults to drive-alone)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vehicle_trip_weight(
    mode TEXT,
    occupants INT DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF mode IS NULL THEN
        -- Non-response defaults to drive-alone per Rule 2202 ECRP Guidelines
        RETURN 1;
    END IF;

    CASE lower(mode)
        WHEN 'drive_alone' THEN
            RETURN 1;

        WHEN 'carpool' THEN
            IF occupants IS NULL OR occupants < 2 OR occupants > 6 THEN
                RAISE EXCEPTION 'carpool occupants must be between 2 and 6, got %', occupants;
            END IF;
            RETURN ROUND(1.0 / occupants, 6);

        WHEN 'vanpool' THEN
            IF occupants IS NULL OR occupants < 7 OR occupants > 15 THEN
                RAISE EXCEPTION 'vanpool occupants must be between 7 and 15, got %', occupants;
            END IF;
            RETURN ROUND(1.0 / occupants, 6);

        WHEN 'shared_motorcycle' THEN
            IF occupants IS NULL OR occupants < 1 THEN
                RAISE EXCEPTION 'shared_motorcycle occupants must be a positive integer, got %', occupants;
            END IF;
            RETURN ROUND(1.0 / occupants, 6);

        WHEN 'transit', 'bus_pool', 'bicycle', 'walk', 'telecommute',
             'cww_day_off', 'zev', 'non_commuting' THEN
            RETURN 0;

        ELSE
            -- Unrecognized mode: treat as drive_alone (1) per non-response handling
            RETURN 1;
    END CASE;
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: calculate_ert
-- Formula (plain notation): ERT (lbs/year) = (employee_count * reduction_factor) - vtec
-- Reusable per-pollutant: call once each for VOC, NOx, CO with the
-- pollutant-specific reduction_factor and vtec values.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_ert(
    employee_count INT,
    reduction_factor NUMERIC,
    vtec NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF employee_count IS NULL OR reduction_factor IS NULL OR vtec IS NULL THEN
        RETURN NULL;
    END IF;

    -- ERT = (employee_count * reduction_factor) - vtec
    RETURN ROUND((employee_count::NUMERIC * reduction_factor) - vtec, 2);
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: calculate_vtec_peak
-- Formula (plain notation): VTEC = ccvr * emission_factor
-- CCVR = daily average creditable commute vehicle reductions
-- emission_factor = lbs/year/daily commute vehicle
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_vtec_peak(
    ccvr NUMERIC,
    emission_factor NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF ccvr IS NULL OR emission_factor IS NULL THEN
        RETURN NULL;
    END IF;

    -- VTEC = ccvr * emission_factor
    RETURN ROUND(ccvr * emission_factor, 2);
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: calculate_vtec_other
-- Formula (plain notation): VTEC = (ctr / cf) * emission_factor
-- cf = 2.0 if is_peak_window = true, else 2.3
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_vtec_other(
    ctr NUMERIC,
    is_peak_window BOOLEAN,
    emission_factor NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    cf NUMERIC;
BEGIN
    IF ctr IS NULL OR is_peak_window IS NULL OR emission_factor IS NULL THEN
        RETURN NULL;
    END IF;

    IF is_peak_window THEN
        cf := 2.0;
    ELSE
        cf := 2.3;
    END IF;

    -- VTEC = (ctr / cf) * emission_factor
    RETURN ROUND((ctr / cf) * emission_factor, 2);
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: calculate_vtec_offpeak_avr
-- Formula (plain notation):
--   AVR = peak_employees / (peak_vehicle_trips - (ccvr / 2.3))
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_vtec_offpeak_avr(
    peak_employees INT,
    peak_vehicle_trips NUMERIC,
    ccvr NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    denominator NUMERIC;
BEGIN
    IF peak_employees IS NULL OR peak_vehicle_trips IS NULL OR ccvr IS NULL THEN
        RETURN NULL;
    END IF;

    denominator := peak_vehicle_trips - (ccvr / 2.3);

    IF denominator IS NULL OR denominator <= 0 THEN
        RETURN NULL;
    END IF;

    -- AVR = peak_employees / (peak_vehicle_trips - (ccvr / 2.3))
    RETURN ROUND(peak_employees::NUMERIC / denominator, 2);
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: calculate_reduced_staffing_avr
-- Formula (plain notation):
--   AVR = (regular_employees * total_annual_days) /
--         ((regular_vehicle_trips * regular_days) +
--          (reduced_vehicle_trips * reduced_days * 1.15))
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_reduced_staffing_avr(
    regular_employees INT,
    total_annual_days INT,
    regular_vehicle_trips NUMERIC,
    regular_days INT,
    reduced_vehicle_trips NUMERIC,
    reduced_days INT
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    numerator NUMERIC;
    denominator NUMERIC;
BEGIN
    IF regular_employees IS NULL OR total_annual_days IS NULL
       OR regular_vehicle_trips IS NULL OR regular_days IS NULL
       OR reduced_vehicle_trips IS NULL OR reduced_days IS NULL THEN
        RETURN NULL;
    END IF;

    numerator := regular_employees::NUMERIC * total_annual_days;
    denominator := (regular_vehicle_trips * regular_days)
                   + (reduced_vehicle_trips * reduced_days * 1.15);

    IF denominator IS NULL OR denominator = 0 THEN
        RETURN NULL;
    END IF;

    -- AVR = (regular_employees * total_annual_days) /
    --       ((regular_vehicle_trips * regular_days) + (reduced_vehicle_trips * reduced_days * 1.15))
    RETURN ROUND(numerator / denominator, 2);
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: inter_pollutant_credit
-- Formula (plain notation):
--   VOC -> CO equivalent = amount * 10
--   NOx -> CO equivalent = amount * 6
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION inter_pollutant_credit(
    pollutant TEXT,
    amount NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF pollutant IS NULL OR amount IS NULL THEN
        RAISE EXCEPTION 'pollutant and amount are required';
    END IF;

    CASE lower(pollutant)
        WHEN 'voc' THEN
            -- CO equivalent = amount * 10
            RETURN ROUND(amount * 10, 0);
        WHEN 'nox' THEN
            -- CO equivalent = amount * 6
            RETURN ROUND(amount * 6, 0);
        ELSE
            RAISE EXCEPTION 'inter_pollutant_credit: unsupported pollutant "%", expected voc or nox', pollutant;
    END CASE;
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: get_avr_zone_target
-- Formula (plain notation): AVR target lookup by Performance Zone
--   Zone 1 = 1.75, Zone 2 = 1.5, Zone 3 = 1.3
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_avr_zone_target(
    zone INT
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE zone
        WHEN 1 THEN
            RETURN 1.75;
        WHEN 2 THEN
            RETURN 1.5;
        WHEN 3 THEN
            RETURN 1.3;
        ELSE
            RAISE EXCEPTION 'invalid AVR performance zone';
    END CASE;
END;
$$;


-- ----------------------------------------------------------------------------
-- Source: Rule 2202 Implementation Guidelines (June 2014) / ECRP Guidelines (Feb 2016)
-- FUNCTION: validate_avr_survey
-- Formula (plain notation):
--   valid only if response_rate >= 0.60
--   AND (submittal_date - survey_end_date) <= 183 days
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_avr_survey(
    response_rate NUMERIC,
    survey_end_date DATE,
    submittal_date DATE
) RETURNS TABLE(is_valid BOOLEAN, reason TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF response_rate IS NULL OR survey_end_date IS NULL OR submittal_date IS NULL THEN
        RETURN QUERY SELECT FALSE, 'missing required survey validation input'::TEXT;
        RETURN;
    END IF;

    IF response_rate < 0.60 THEN
        RETURN QUERY SELECT FALSE, 'response rate below 60% minimum'::TEXT;
        RETURN;
    END IF;

    IF (submittal_date - survey_end_date) > 183 THEN
        RETURN QUERY SELECT FALSE, 'survey data exceeds 6-month staleness limit'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;
