-- Spike Tennis — shared constants
local Constants = {}

Constants.COURT = {
    LENGTH       = 78,
    WIDTH        = 36,
    HALF_LENGTH  = 39,
    HALF_WIDTH   = 18,
    SERVICE_DEPTH = 21,   -- service line distance from net
    NET_HEIGHT   = 3.5,
    FLOOR_Y      = 0,
}

Constants.BALL = {
    RADIUS        = 0.55,
    BOUNCE_FACTOR = 0.60,
    SPIN_FACTOR   = 0.88,
}

Constants.SHOTS = {
    SERVE_SPEED   = 95,
    FLAT_SPEED    = 72,
    TOPSPIN_SPEED = 58,
    SLICE_SPEED   = 48,
    LOB_SPEED     = 38,
    SMASH_SPEED   = 88,

    HIT_RANGE            = 9,
    PERFECT_WINDOW       = 0.18,
    GOOD_WINDOW          = 0.38,
    PERFECT_BONUS        = 1.25,
    GOOD_BONUS           = 1.0,
    MISS_PENALTY         = 0.60,

    LOB_ARC_HEIGHT       = 18,
    FLAT_ARC_HEIGHT      = 3,
    TOPSPIN_ARC_HEIGHT   = 5,
    SLICE_ARC_HEIGHT     = 2,
}

Constants.GAME = {
    SERVE_TOSS_HEIGHT = 14,
    SERVE_TOSS_TIME   = 1.4,
    POINT_DELAY       = 2.5,
    RALLY_DELAY       = 1.5,
}

Constants.COLORS = {
    COURT_MAIN     = Color3.fromRGB(15, 100, 190),
    COURT_SERVICE  = Color3.fromRGB(10, 82, 165),
    COURT_SURROUND = Color3.fromRGB(40, 140, 60),
    LINE           = Color3.fromRGB(255, 255, 255),
    NET_BODY       = Color3.fromRGB(25, 25, 25),
    NET_TAPE       = Color3.fromRGB(240, 240, 240),
    NET_POST       = Color3.fromRGB(200, 200, 200),
    BALL           = Color3.fromRGB(178, 255, 20),
    BALL_TRAIL     = Color3.fromRGB(255, 245, 60),
    HIT_SPARK      = Color3.fromRGB(255, 200, 50),
}

return Constants
