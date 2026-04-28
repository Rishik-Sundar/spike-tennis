-- Spike Tennis — shot trajectory solver
local Constants = require(script.Parent.Constants)

local ShotPhysics = {}

-- Arc heights per shot type (studs above the hitter)
local ARC = {
    flat     = Constants.SHOTS.FLAT_ARC_HEIGHT,
    topspin  = Constants.SHOTS.TOPSPIN_ARC_HEIGHT,
    slice    = Constants.SHOTS.SLICE_ARC_HEIGHT,
    lob      = Constants.SHOTS.LOB_ARC_HEIGHT,
    smash    = -1,
    serve    = 4,
}

-- Given launch position, target position, desired peak arc height, and gravity,
-- return the Vector3 launch velocity that produces a perfect parabolic arc.
local function solveArc(from, to, arcHeight, gravity)
    local dx = to.X - from.X
    local dz = to.Z - from.Z
    local dy = to.Y - from.Y
    local hDist = math.sqrt(dx * dx + dz * dz)

    -- Smash: aim steeply downward
    if arcHeight < 0 then
        local t = 0.35
        return Vector3.new(dx / t, dy / t - 0.5 * gravity * t, dz / t)
    end

    -- vy needed to reach the peak above the hitter
    local vy = math.sqrt(2 * gravity * math.max(arcHeight, 0.5))

    -- Solve quadratic for total time of flight
    -- from.Y + vy*t - 0.5*g*t^2 = to.Y
    local disc = vy * vy - 2 * gravity * dy
    if disc < 0 then
        -- arc too low for this height difference; raise vy
        vy = math.sqrt(math.max(2 * gravity * (dy + arcHeight), 0.5))
        disc = vy * vy - 2 * gravity * dy
    end
    disc = math.max(disc, 0)

    local t = (vy + math.sqrt(disc)) / gravity
    if t < 0.05 then t = 0.05 end

    local vx = dx / t
    local vz = dz / t
    return Vector3.new(vx, vy, vz)
end

-- Public: calculate launch velocity for a shot
-- from:          Vector3 hitter root position
-- to:            Vector3 intended landing spot (on opponent's court surface)
-- shotType:      string  "flat"|"topspin"|"slice"|"lob"|"smash"|"serve"
-- timingQuality: 0..1    0 = whiff, 1 = perfect
function ShotPhysics.calculateVelocity(from, to, shotType, timingQuality)
    local gravity = math.abs(workspace.Gravity)
    local arc = ARC[shotType] or ARC.flat

    local speeds = {
        flat    = Constants.SHOTS.FLAT_SPEED,
        topspin = Constants.SHOTS.TOPSPIN_SPEED,
        slice   = Constants.SHOTS.SLICE_SPEED,
        lob     = Constants.SHOTS.LOB_SPEED,
        smash   = Constants.SHOTS.SMASH_SPEED,
        serve   = Constants.SHOTS.SERVE_SPEED,
    }
    local baseSpeed = speeds[shotType] or Constants.SHOTS.FLAT_SPEED

    -- Timing multiplier: perfect = 1.25x, good = 1.0x, bad = 0.6x
    local mult
    if timingQuality >= 0.85 then
        mult = Constants.SHOTS.PERFECT_BONUS
    elseif timingQuality >= 0.5 then
        mult = Constants.SHOTS.GOOD_BONUS
    else
        mult = Constants.SHOTS.MISS_PENALTY
        -- bad timing: random slight mis-hit direction
        local scatter = (1 - timingQuality) * 4
        to = to + Vector3.new(
            math.random() * scatter - scatter / 2,
            0,
            math.random() * scatter - scatter / 2
        )
    end

    local vel = solveArc(from, to, arc, gravity)

    -- Scale velocity magnitude to the target speed
    local currentMag = vel.Magnitude
    if currentMag > 0 then
        vel = vel * (baseSpeed * mult / currentMag)
    end

    return vel
end

-- Calculate post-bounce velocity
function ShotPhysics.calculateBounce(inVel, shotType)
    local bx = inVel.X * Constants.BALL.SPIN_FACTOR
    local by = math.abs(inVel.Y) * Constants.BALL.BOUNCE_FACTOR
    local bz = inVel.Z * Constants.BALL.SPIN_FACTOR

    if shotType == "topspin" then
        by = by * 0.72
        bx = bx * 1.12
        bz = bz * 1.12
    elseif shotType == "slice" then
        by = by * 1.18
        bx = bx * 0.80
        bz = bz * 0.80
    end

    return Vector3.new(bx, by, bz)
end

-- Check if a position is inside the singles baseline box on the given side
-- side: 1 = positive Z, -1 = negative Z
function ShotPhysics.isInCourt(pos, targetSide)
    local C = Constants.COURT
    local inX = math.abs(pos.X) <= C.HALF_WIDTH / 2  -- singles sideline
    local inZ = targetSide == 1
        and (pos.Z >= 0 and pos.Z <= C.HALF_LENGTH)
        or  (pos.Z <= 0 and pos.Z >= -C.HALF_LENGTH)
    return inX and inZ
end

return ShotPhysics
