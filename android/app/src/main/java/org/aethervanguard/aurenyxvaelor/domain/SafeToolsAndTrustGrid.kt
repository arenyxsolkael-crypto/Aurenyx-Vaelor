package org.aethervanguard.aurenyxvaelor.domain

import kotlin.math.pow
import kotlin.math.roundToLong
import kotlin.math.sqrt

object LocalSecretScanner {
    private val secretPatterns = listOf(
        Regex("AIza[0-9A-Za-z_-]{25,}"),
        Regex("sk-[A-Za-z0-9_-]{20,}"),
        Regex("ghp_[A-Za-z0-9]{25,}"),
        Regex("-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
    )

    fun containsSecret(text: String): Boolean {
        return secretPatterns.any { it.containsMatchIn(text) }
    }

    fun redactSecrets(raw: String): String {
        var cleaned = raw
        for (pattern in secretPatterns) {
            cleaned = pattern.replace(cleaned, "[REDACTED_CREDENTIAL]")
        }
        return cleaned.take(360)
    }
}

/**
 * Deterministic recursive-descent arithmetic evaluator (zero eval / reflection).
 */
object SafeMathEvaluator {
    private val allowedChars = Regex("^[0-9+\\-*/^().,\\sA-Za-z]+$")

    fun evaluate(expression: String): Double {
        val trimmed = expression.trim()
        require(trimmed.isNotEmpty() && trimmed.length <= 240) {
            "Expression must be 1..240 characters."
        }
        require(allowedChars.matches(trimmed)) {
            "Unsupported characters in math expression."
        }
        val parser = Parser(trimmed)
        val result = parser.parseExpression()
        parser.skipWhitespace()
        require(parser.isAtEnd()) { "Unexpected token near '${parser.remaining()}'" }
        require(result.isFinite()) { "Result is not a finite number." }
        return result
    }

    private class Parser(private val src: String) {
        private var pos = 0

        fun isAtEnd(): Boolean = pos >= src.length
        fun remaining(): String = src.substring(pos)

        fun skipWhitespace() {
            while (pos < src.length && src[pos].isWhitespace()) pos++
        }

        fun parseExpression(): Double {
            var left = parseTerm()
            while (true) {
                skipWhitespace()
                if (match('+')) left += parseTerm()
                else if (match('-')) left -= parseTerm()
                else break
            }
            return left
        }

        private fun parseTerm(): Double {
            var left = parsePower()
            while (true) {
                skipWhitespace()
                if (match('*')) left *= parsePower()
                else if (match('/')) {
                    val divisor = parsePower()
                    require(divisor != 0.0) { "Division by zero." }
                    left /= divisor
                } else break
            }
            return left
        }

        private fun parsePower(): Double {
            val base = parseUnary()
            skipWhitespace()
            return if (match('^')) base.pow(parsePower()) else base
        }

        private fun parseUnary(): Double {
            skipWhitespace()
            if (match('+')) return parseUnary()
            if (match('-')) return -parseUnary()
            return parsePrimary()
        }

        private fun parsePrimary(): Double {
            skipWhitespace()
            if (match('(')) {
                val inner = parseExpression()
                skipWhitespace()
                require(match(')')) { "Missing closing parenthesis." }
                return inner
            }

            if (pos < src.length && src[pos].isLetter()) {
                val start = pos
                while (pos < src.length && src[pos].isLetter()) pos++
                val fn = src.substring(start, pos).lowercase()
                skipWhitespace()
                require(match('(')) { "Expected '(' after function $fn" }
                val arg = parseExpression()
                skipWhitespace()
                require(match(')')) { "Expected ')' after function argument" }
                return when (fn) {
                    "sqrt" -> {
                        require(arg >= 0.0) { "Cannot take sqrt of negative number." }
                        sqrt(arg)
                    }
                    "round" -> arg.roundToLong().toDouble()
                    "abs" -> kotlin.math.abs(arg)
                    else -> throw IllegalArgumentException("Unsupported function '$fn'")
                }
            }

            val start = pos
            while (pos < src.length && (src[pos].isDigit() || src[pos] == '.')) pos++
            require(pos > start) { "Expected number in expression." }
            return src.substring(start, pos).toDoubleOrNull()
                ?: throw IllegalArgumentException("Invalid number literal.")
        }

        private fun match(ch: Char): Boolean {
            if (pos < src.length && src[pos] == ch) {
                pos++
                return true
            }
            return false
        }
    }
}

/**
 * Embedded Aurenyx TrustGrid Provisional Risk Engine (TG-PROVISIONAL-0.1).
 */
object TrustGridEngine {
    const val METHODOLOGY_VERSION = "TG-PROVISIONAL-0.1"

    enum class DataSensitivity(val label: String, val points: Int, val triggersFlag: Boolean) {
        PUBLIC("Public information", 0, false),
        INTERNAL("Internal non-sensitive", 1, false),
        PERSONAL("Personal or sensitive", 2, false),
        CONFIDENTIAL_REGULATED("Confidential or regulated", 2, true)
    }

    enum class Autonomy(val label: String, val points: Int, val triggersFlag: Boolean) {
        SUGGESTIONS("Suggestions only", 0, false),
        HUMAN_DRAFTS("Human-reviewed drafts", 1, false),
        LIMITED_AUTO("Limited automatic actions", 2, false),
        CONSEQUENTIAL_AUTO("Consequential actions, minimal oversight", 2, true)
    }

    enum class Impact(val label: String, val points: Int, val triggersFlag: Boolean) {
        MINOR("Minor inconvenience", 0, false),
        OPERATIONAL("Operational disruption", 1, false),
        FINANCIAL_PRIVACY("Financial or privacy impact", 2, false),
        LEGAL_SAFETY("Significant legal, safety, or business impact", 2, true)
    }

    enum class Logging(val label: String, val points: Int) {
        COMPREHENSIVE("Relevant events logged & reviewable", 0),
        PARTIAL("Partial logging", 1),
        WEAK("Weak or missing logging", 2)
    }

    enum class Approval(val label: String, val points: Int) {
        REQUIRED("Human approval enforced", 0),
        INCONSISTENT("Inconsistent human approval", 1),
        NONE("No human approval for sensitive actions", 2)
    }

    data class EvaluationInput(
        val workflowName: String,
        val dataSensitivity: DataSensitivity,
        val autonomy: Autonomy,
        val impact: Impact,
        val externalUntrustedInput: Boolean,
        val logging: Logging,
        val approval: Approval,
        val missingRollbackProcedure: Boolean
    )

    data class EvaluationOutput(
        val methodologyVersion: String,
        val score: Int,
        val riskBand: String,
        val breakdown: List<String>,
        val criticalReviewFlags: List<String>
    )

    fun evaluate(input: EvaluationInput): EvaluationOutput {
        val breakdown = mutableListOf<String>()
        val flags = mutableListOf<String>()

        var total = 0
        total += input.dataSensitivity.points
        breakdown += "Data sensitivity (${input.dataSensitivity.label}): +${input.dataSensitivity.points}"
        if (input.dataSensitivity.triggersFlag) {
            flags += "FLAG_CONFIDENTIAL_REGULATED_DATA: Confidential or regulated data requires dedicated review."
        }

        total += input.autonomy.points
        breakdown += "Autonomy (${input.autonomy.label}): +${input.autonomy.points}"
        if (input.autonomy.triggersFlag) {
            flags += "FLAG_CONSEQUENTIAL_AUTONOMY: Consequential actions execute with minimal human oversight."
        }

        total += input.impact.points
        breakdown += "Potential impact (${input.impact.label}): +${input.impact.points}"
        if (input.impact.triggersFlag) {
            flags += "FLAG_SIGNIFICANT_IMPACT: Failure may cause significant legal, safety, or business harm."
        }

        if (input.externalUntrustedInput) {
            total += 1
            breakdown += "External or untrusted input exposure: +1"
        } else {
            breakdown += "External or untrusted input exposure (No): +0"
        }

        total += input.logging.points
        breakdown += "Logging (${input.logging.label}): +${input.logging.points}"

        total += input.approval.points
        breakdown += "Human approval (${input.approval.label}): +${input.approval.points}"

        if (input.missingRollbackProcedure) {
            total += 1
            breakdown += "No stop or rollback procedure: +1"
        } else {
            breakdown += "Stop or rollback procedure present/not required: +0"
        }

        val band = when {
            total >= 10 -> "Critical"
            total >= 7 -> "High"
            total >= 4 -> "Moderate"
            else -> "Low"
        }

        return EvaluationOutput(
            methodologyVersion = METHODOLOGY_VERSION,
            score = total,
            riskBand = band,
            breakdown = breakdown,
            criticalReviewFlags = flags
        )
    }
}
