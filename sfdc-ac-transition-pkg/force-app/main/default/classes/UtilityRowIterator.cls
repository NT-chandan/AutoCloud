/*
 * Copyright (c) 2023, Salesforce, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: Apache 2.0 Clause
 * For full license text, see the LICENSE file in the repo root or http://www.apache.org/licenses/
 */
public inherited sharing class UtilityRowIterator implements Iterator<String>, Iterable<String>
{
   private String m_Data;
   private Integer m_index = 0;
   private String m_rowDelimiter = ',';
    
   public UtilityRowIterator(String fileData)
   {
      m_Data = fileData; 
   }
   public UtilityRowIterator(String fileData, String rowDelimiter)
   {
      m_Data = fileData; 
      m_rowDelimiter = rowDelimiter;
   }
    
   public Boolean hasNext()
   {
      return m_index < m_Data.length() ? true : false;
   }
   public String next()
   {     
      Integer key = m_Data.indexOf(m_rowDelimiter, m_index);
       
      if (key == -1)
        key = m_Data.length();
             
      String row = m_Data.subString(m_index, key);
      m_index = key + 1;
      return row;
   }
   public Iterator<String> Iterator()
   {
      return this;   
   }
}