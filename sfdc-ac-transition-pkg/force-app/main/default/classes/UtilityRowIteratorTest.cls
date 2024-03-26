@isTest
public class UtilityRowIteratorTest {
    
    // Test method to cover the hasNext() and next() methods
    @isTest
    static void testIterator() {
        // Prepare test data
        String fileData = 'row1,row2,row3';
        
        // Instantiate the UtilityRowIterator
        UtilityRowIterator iterator = new UtilityRowIterator(fileData);
        UtilityRowIterator iterator1 = new UtilityRowIterator(fileData,',');
        // Test hasNext() and next() methods
        // Iterate through the rows and verify
        System.assertEquals(true, iterator.hasNext());
        System.assertEquals('row1', iterator.next());
        System.assertEquals(true, iterator.hasNext());
        System.assertEquals('row2', iterator.next());
        System.assertEquals(true, iterator.hasNext());
        System.assertEquals('row3', iterator.next());
        System.assertEquals(false, iterator.hasNext()); // Ensure hasNext() returns false after iterating through all rows
    }
    
    // Test method to cover the Iterator() method
    // @isTest
    // static void testIterable() {
    //     // Prepare test data
    //     String fileData = 'row1,row2,row3';
        
    //     // Instantiate the UtilityRowIterator
    //     UtilityRowIterator iterator = new UtilityRowIterator(fileData);
        
    //     // Test the Iterable() method
    //     Iterable<String> iterable = iterator.Iterator();
        
    //     // Verify that the returned iterable object is not null
    //     System.assertNotEquals(null, iterable);
        
    //     // Verify that we can iterate through the iterable object
    //     Integer count = 0;
    //     for (String row : iterable) {
    //         count++;
    //     }
    //     // Ensure that the number of rows matches the count of rows in the test data
    //     System.assertEquals(3, count);
    // }
}