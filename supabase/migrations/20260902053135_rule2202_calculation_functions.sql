-- ============================================================================
-- Migration: Rule 2202 Deterministic Compliance Calculation Functions
-- South Coast AQMD On-Road Motor Vehicle Mitigation Options
-- All functions are pure, deterministic PL/pgSQL arithmetic.
-- No AI/LLM calls, no external I/O, no non-deterministic inputs.
-- ============================================================================

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
    RETURN ROUND(window_employees::NUMERIC / window_vehicle_trips, 2);
END;
$$;

CREATE OR REPLACE FUNCTION vehicle_trip_weight(
    mode TEXT,
    occupants INT DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF mode IS NULL THEN
        RETURN 1;
    END IF;
    CASE lower(mode)
        WHEN 'drive_alone' THEN RETURN 1;
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
            RETURN 1;
    END CASE;
END;
$$;

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
    RETURN ROUND((employee_count::NUMERIC * reduction_factor) - vtec, 2);
END;
$$;

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
    RETURN ROUND(ccvr * emission_factor, 2);
END;
$$;

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
    IF is_peak_window THEN cf := 2.0; ELSE cf := 2.3; END IF;
    RETURN ROUND((ctr / cf) * emission_factor, 2);
END;
$$;

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
    IF denominator IS NULL OR denominator <= 0 THEN RETURN NULL; END IF;
    RETURN ROUND(peak_employees::NUMERIC / denominator, 2);
END;
$$;

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
    IF denominator IS NULL OR denominator = 0 THEN RETURN NULL; END IF;
    RETURN ROUND(numerator / denominator, 2);
END;
$$;

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
        WHEN 'voc' THEN RETURN ROUND(amount * 10, 0);
        WHEN 'nox' THEN RETURN ROUND(amount * 6, 0);
        ELSE RAISE EXCEPTION 'inter_pollutant_credit: unsupported pollutant "%", expected voc or nox', pollutant;
    END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION get_avr_zone_target(
    zone INT
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE zone
        WHEN 1 THEN RETURN 1.75;
        WHEN 2 THEN RETURN 1.5;
        WHEN 3 THEN RETURN 1.3;
        ELSE RAISE EXCEPTION 'invalid AVR performance zone';
    END CASE;
END;
$$;

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
