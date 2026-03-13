# Salesforce Custom Fields Required

These custom fields must be created in your Salesforce org for the Flash Delivery app to work.

## Account (PersonAccount)

| Field API Name | Type | Length | Description |
|---|---|---|---|
| `Password_Hash__c` | Text (Encrypted) | 255 | Bcrypt hash for email/password auth |
| `Auth_Provider__c` | Picklist | - | Values: `email`, `google`, `apple` |
| `PhoneID__c` | Text | 20 | E164 phone without `+` prefix |
| `Language__c` | Picklist | - | Values: `French`, `English` |
| `Company_OR_PrivateIndividual__c` | Picklist | - | Values: `Company`, `PrivateIndividual` |
| `Main_Pickup_Location__c` | Text | 255 | Default pickup address |
| `Main_Pickup_GeoLocation__c` | Geolocation | - | Default pickup lat/lng |
| `Main_Delivery_Location__c` | Text | 255 | Default delivery address |
| `Main_Delivery_GeoLocation__c` | Geolocation | - | Default delivery lat/lng |
| `Delivery_Scoring__c` | Picklist | - | Values: `High`, `Medium`, `Low` |
| `Pickup_Scoring__c` | Picklist | - | Values: `High`, `Medium`, `Low` |
| `Delivery_Revenue__c` | Currency | - | Total delivery revenue |
| `Last_Sent_Delivery__c` | Date | - | Last delivery date |
| `Flash_Delivery_Follow_up_Date__c` | Date | - | Follow-up date |
| `Account_Manager__c` | Lookup(Employee__c) | - | Assigned account manager |

## Employee__c (Custom Object)

| Field API Name | Type | Length | Description |
|---|---|---|---|
| `First_Name__c` | Text | 80 | First name |
| `Last_Name__c` | Text | 80 | Last name |
| `Salutation__c` | Picklist | - | Mr., Mrs., etc. |
| `Email__c` | Email | - | Employee email (used for login) |
| `Mobile__c` | Phone | - | Mobile number |
| `Title__c` | Picklist | - | Values: `C-Level`, `Delivery Manager`, `Sales Rep`, `Service Rep`, `Driver` |
| `Password_Hash__c` | Text (Encrypted) | 255 | Bcrypt hash for email/password auth |
| `IsActive__c` | Checkbox | - | Active employee flag |
| `IsTest__c` | Checkbox | - | Test record flag |
| `Birthday__c` | Date | - | Birthday |
| `Company__c` | Lookup(Account) | - | Company association |
| `Customer_Service__c` | Checkbox | - | Customer service flag |
| `Current_Location__c` | Geolocation | - | Driver's current GPS location |
| `Current_Location_DateTime__c` | DateTime | - | When location was last updated |
| `Deactivation_DateTime__c` | DateTime | - | When employee was deactivated |

## Delivery__c (Custom Object)

| Field API Name | Type | Length | Description |
|---|---|---|---|
| `Delivery_Reference__c` | Auto Number | - | e.g., `FD-{0000}` |
| `Sender__c` | Lookup(Account) | - | Sender account |
| `Recipient__c` | Lookup(Account) | - | Recipient account |
| `Status__c` | Picklist | - | Values: `Ordered`, `Picked up`, `Canceled`, `Delivered` |
| `Type__c` | Picklist | - | Delivery type |
| `Payment_Method__c` | Picklist | - | Payment method |
| `Pickup_Location_Name__c` | Text | 255 | Pickup address |
| `Pickup_Geolocation__c` | Geolocation | - | Pickup lat/lng |
| `Delivery_Location_Name__c` | Text | 255 | Delivery address |
| `Delivery_Geolocation__c` | Geolocation | - | Delivery lat/lng |
| `Description__c` | Text Area | 255 | Package description |
| `Comment__c` | Text Area | 255 | Additional comments |
| `Distance__c` | Number | - | Distance in km |
| `AmountFormula__c` | Currency (Formula) | - | Calculated delivery price |
| `Amount_collected__c` | Currency | - | Amount collected on delivery |
| `Booking_DateTime__c` | DateTime | - | When delivery was ordered |
| `Delivery_DateTime__c` | DateTime | - | When delivery was completed |
| `Picked_Up_DateTime__c` | DateTime | - | When package was picked up |
| `Delivery_Time_Mins__c` | Number | - | Total delivery time in minutes |
| `Pickup_Time_Mins__c` | Number | - | Pickup time in minutes |
| `Driver__c` | Lookup(Employee__c) | - | Assigned driver |
| `Delivery_Manager__c` | Lookup(Employee__c) | - | Delivery manager |
| `Sales_Rep__c` | Lookup(Employee__c) | - | Sales representative |
| `Free_Delivery__c` | Checkbox | - | Free delivery flag |
| `Cancelation_Reason__c` | Text | 255 | Cancellation reason |
| `Missing_Information__c` | Text | 255 | Missing info notes |
| `Delivery_City__c` | Text | 50 | City name |

## Payment__c (Custom Object)

| Field API Name | Type | Length | Description |
|---|---|---|---|
| `Account__c` | Lookup(Account) | - | Associated account |
| `Amount__c` | Currency | - | Payment amount |
| `Total_Paid__c` | Currency | - | Total paid (rollup from line items) |
| `Balance__c` | Currency (Formula) | - | Amount - Total_Paid |
| `Status__c` | Picklist | - | Values: `Draft`, `Pending`, `Completed`, `Failed`, `Cancelled` |
| `Type__c` | Picklist | - | Values: `Income`, `Expense` |
| `Due_Date__c` | Date | - | Payment due date |
| `Label__c` | Text | 255 | Payment label/description |
| `Income_Category__c` | Picklist | - | e.g., `Delivery` |
| `Expense_Category__c` | Picklist | - | Expense category |
| `WhatID__c` | Text | 18 | Polymorphic reference (Delivery ID) |
| `Related_Object__c` | Text | 50 | Object type for WhatID |
| `Recurrence__c` | Picklist | - | Recurring payment schedule |

## Transaction_LineItem__c (Custom Object)

| Field API Name | Type | Length | Description |
|---|---|---|---|
| `Financial_Transaction__c` | Master-Detail(Payment__c) | - | Parent payment |
| `Amount__c` | Currency | - | Line item amount |
