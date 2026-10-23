package dev.dshmobile.validation

import java.math.BigInteger

/** 与JS契约范围保持一致；只决定协议族，通知能力仍在协商时独立检查。 */
internal object RemoteDshCompatibility {
    private data class Version(val core: List<BigInteger>, val pre: List<String>) : Comparable<Version> {
        override fun compareTo(other: Version): Int {
            core.zip(other.core).forEach { (a, b) -> if (a != b) return a.compareTo(b) }
            if (pre.isEmpty() || other.pre.isEmpty()) return when {
                pre.isEmpty() && other.pre.isEmpty() -> 0
                pre.isEmpty() -> 1
                else -> -1
            }
            pre.zip(other.pre).forEach { (a, b) ->
                if (a != b) {
                    val an = a.all(Char::isDigit); val bn = b.all(Char::isDigit)
                    return when {
                        an && bn -> a.toBigInteger().compareTo(b.toBigInteger())
                        an -> -1
                        bn -> 1
                        else -> a.compareTo(b)
                    }
                }
            }
            return pre.size.compareTo(other.pre.size)
        }
    }
    private val format = Regex("v?(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?")
    private fun parse(value: String): Version? {
        if (value.length > 256) return null
        val match = format.matchEntire(value) ?: return null
        val pre = match.groupValues[4].takeIf(String::isNotEmpty)?.split('.') ?: emptyList()
        if (pre.any { it.length > 1 && it[0] == '0' && it.all(Char::isDigit) }) return null
        val core = match.groupValues.subList(1, 4).map(String::toBigInteger)
        if (core.any { it > BigInteger.valueOf(9007199254740991L) }) return null
        return Version(core, pre)
    }
    fun accepts(sdk: String, host: String): Boolean {
        val client = parse(sdk) ?: return false
        val server = parse(host) ?: return false
        return sdk == host || (client >= parse("0.2.1-alpha.2")!! && client < parse("0.3.0-0")!!
            && server >= parse("0.2.0-rc.2")!! && server < parse("0.3.0-0")!!)
    }
}
