# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-05-06

### Added
- Support for sequence number tracking: now extracts both legal (`LglSeqNb`) and electronic (`ElctrncSeqNb`) sequence numbers for tracking statement chronology
- Added `sequenceNumber` field to the `Camt053Statement` interface, which can come from either `LglSeqNb` or `ElctrncSeqNb`
- New `samples` npm script for easier testing with sample files

## [2.0.0] - 2025-04-12

### Added
- Initial public release
- Support for multiple CAMT.053 versions: Out-of-the-box support for .001.02, .001.08, .001.13 (easily extendable)
- XSD validation: Validates input XML against the appropriate XSD schema before parsing
- Robust field extraction: Handles a wide variety of bank-specific layouts, including missing or non-standard fields
- Batch and multi-transaction support: Correctly extracts all transactions, even when multiple `<TxDtls>` are present or missing
- Graceful fallbacks: Provides sensible fallbacks for missing fields (e.g., uses Ntry-level info if TxDtls is missing)
- Comprehensive output: Extracts account, balance, transaction, counterparty, remittance, and description fields
- Sample files and schemas included: Test with real-world samples and official XSDs
